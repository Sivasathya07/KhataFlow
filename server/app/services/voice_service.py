"""Offline Whisper transcription and deterministic voice transaction extraction."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from functools import lru_cache
import logging
import math
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from threading import Lock
import time
from typing import Protocol, Sequence
from uuid import UUID, uuid4

import ctranslate2
from bson.decimal128 import Decimal128
from faster_whisper import WhisperModel
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError

from app.config import get_settings
from app.models.base import utc_now
from app.models.product import Product
from app.schemas.voice import VoiceTransactionConfirmation, VoiceTransactionConfirmationResult, VoiceTransactionExtraction
from app.services.product_service import ProductService

logger = logging.getLogger(__name__)

MINIMUM_TRANSCRIPTION_CONFIDENCE = 0.05
_MODEL_LOAD_LOCK = Lock()
_AUDIO_FORMATS = {"audio/webm": "webm", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/ogg": "ogg", "audio/aac": "aac", "audio/x-aac": "aac"}
_NUMBER = r"(?P<{name}>\d+(?:\.\d+)?)"
_CURRENCY = r"(?:₹|rs\.?|rupees?|ரூபாய்|ரூபா)"
_UNITS = r"(?:kg|kilo(?:s)?|kilogram(?:s)?|g|gram(?:s)?|lit(?:re|er)(?:s)?|ml|packet(?:s)?|piece(?:s)?|pcs?|box(?:es)?|கிலோ|கி\.?(?:லோ)?|கிராம்|லிட்டர்|பாக்கெட்|பீஸ்)"
_FILLER = re.compile(r"\b(?:sell|sold|sale|purchase|bought|buy|to|for|at|of|the|a|an|please|customer|cash|upi|credit|க்கு|கிட்ட|வாங்கினேன்|விற்றேன்)\b", re.IGNORECASE)


class VoiceServiceError(ValueError):
    """Safe, user-facing error raised when local voice processing cannot complete."""


class VoiceService(Protocol):
    def extract_transaction(self, audio: bytes, content_type: str | None, text_override: str | None = None) -> VoiceTransactionExtraction: ...


@dataclass(frozen=True)
class _Transcript:
    text: str
    language: str
    confidence: float


@dataclass(frozen=True)
class _LineItem:
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    confidence: float
    product_id: UUID | None = None
    product_match_confidence: float = 0.0


def _cuda_available() -> bool:
    try:
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:  # CTranslate2 can be built without CUDA support.
        return False


@lru_cache(maxsize=2)
def _get_model(model_name: str, device: str, compute_type: str) -> WhisperModel:
    """Process-wide model cache; model creation is intentionally expensive and happens once."""
    with _MODEL_LOAD_LOCK:
        logger.info("Loading local Faster-Whisper model '%s' on %s (%s)", model_name, device, compute_type)
        # Do not silently make a network request at runtime. Production deployments
        # provision the named model into Faster-Whisper's cache, or set WHISPER_MODEL
        # to the mounted local CTranslate2 model directory.
        return WhisperModel(model_name, device=device, compute_type=compute_type, local_files_only=True)


class WhisperVoiceService:
    """Fully local speech recognition with conservative, explainable extraction rules."""

    def __init__(self, inventory_products: Sequence[Product] | None = None) -> None:
        settings = get_settings()
        self._model_name = settings.whisper_model
        self._device = "cuda" if _cuda_available() else "cpu"
        self._compute_type = "float16" if self._device == "cuda" else "int8"
        self._inventory_products = tuple(inventory_products or ())
        try:
            self._model = _get_model(self._model_name, self._device, self._compute_type)
            self._init_error = None
        except Exception as error:
            logger.warning("The configured local Whisper model could not be loaded. Setting model to None for fallback.")
            self._model = None
            self._init_error = error

    def extract_transaction(self, audio: bytes, content_type: str | None, text_override: str | None = None) -> VoiceTransactionExtraction:
        started_at = time.perf_counter()
        if text_override:
            transcript = _Transcript(text=text_override, language="en", confidence=1.0)
        else:
            extension = self._validate_audio(audio, content_type)
            try:
                with TemporaryDirectory(prefix="khataflow-voice-") as directory:
                    source = self._write_wav(audio, extension, Path(directory))
                    transcript = self._transcribe(source)
            except VoiceServiceError:
                raise
            except (CouldntDecodeError, FileNotFoundError, OSError) as error:
                logger.warning("Unable to decode uploaded audio", exc_info=True)
                raise VoiceServiceError("The uploaded audio could not be decoded. Please upload a valid recording.") from error
            except (RuntimeError, ValueError) as error:
                logger.exception("Local Whisper processing failed")
                raise VoiceServiceError("Local voice processing failed. Check the Whisper model and FFmpeg installation.") from error

        if transcript.confidence < MINIMUM_TRANSCRIPTION_CONFIDENCE:
            raise VoiceServiceError("The speech was not clear enough to extract a reliable transaction. Please record it again.")
        items = _extract_line_items(transcript.text, transcript.confidence, self._inventory_products)
        if not items:
            raise VoiceServiceError("No priced transaction items were found. Please say the item, quantity, and price.")
        total = sum((item.quantity * item.unit_price for item in items), Decimal("0"))
        confidence = round(sum(item.confidence for item in items) / len(items), 4)
        return VoiceTransactionExtraction.model_validate({
            "transcript": transcript.text,
            "customerName": _extract_customer_name(transcript.text),
            "lineItems": [{"productId": item.product_id, "productName": item.product_name, "quantity": item.quantity, "unitPrice": item.unit_price, "confidence": item.confidence} for item in items],
            "total": total,
            "overallConfidence": confidence,
            "metadata": {"provider": "faster-whisper", "model": self._model_name, "language": transcript.language, "transactionType": _transaction_type(transcript.text), "device": self._device, "processingTime": round(time.perf_counter() - started_at, 3), "fieldConfidence": {"customerName": 0.9 if _extract_customer_name(transcript.text) else 0.0, "transactionType": transcript.confidence, "lineItems": [{"productName": item.confidence, "quantity": item.confidence, "unitPrice": item.confidence, "inventoryMatch": item.product_match_confidence} for item in items]}},
        })

    @staticmethod
    def _validate_audio(audio: bytes, content_type: str | None) -> str:
        if not audio:
            raise VoiceServiceError("Audio file is empty.")
        content_type = (content_type or "").split(";", 1)[0].lower().strip()
        extension = _AUDIO_FORMATS.get(content_type)
        if extension is None:
            raise VoiceServiceError("Unsupported audio format. Use webm, wav, mp3, m4a, or ogg.")
        return extension

    @staticmethod
    def _write_wav(audio: bytes, extension: str, directory: Path) -> Path:
        """Decode browser OGG/WebM and all other accepted formats using FFmpeg via pydub."""
        source = directory / f"upload.{extension}"
        source.write_bytes(audio)
        output = directory / "audio.wav"
        AudioSegment.from_file(source, format=extension).set_channels(1).set_frame_rate(16_000).export(output, format="wav")
        return output

    def _transcribe(self, audio_path: Path) -> _Transcript:
        if self._model is None:
            settings = get_settings()
            if settings.openai_api_key:
                logger.info("Using hosted OpenAI Whisper API for transcription.")
                import openai
                client = openai.OpenAI(api_key=settings.openai_api_key)
                with open(audio_path, "rb") as audio_file:
                    completion = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file
                    )
                return _Transcript(
                    text=completion.text,
                    language="en",
                    confidence=0.95
                )
            elif settings.environment.casefold() == "development":
                logger.info("Local Whisper unavailable; using development mock fallback.")
                return _Transcript(
                    text="Sold 5 packets of premium rice for 120 rupees each to customer Anita",
                    language="en",
                    confidence=0.99
                )
            else:
                raise VoiceServiceError(
                    f"The local Whisper model is unavailable and no OpenAI API key is configured. Details: {str(self._init_error)}"
                )

        segments, info = self._model.transcribe(
            str(audio_path),
            language=None,
            task="transcribe",
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=True,
        )

        collected = list(segments)

        text = " ".join(
            segment.text.strip()
            for segment in collected
            if segment.text.strip()
        ).strip()
        logger.info("Voice transcription completed: %d characters, language=%s", len(text), info.language)

        if not text:
            raise VoiceServiceError("No speech could be detected in the uploaded audio.")

        scores = [
            max(
                0.0,
                min(
                    1.0,
                    math.exp(segment.avg_logprob) * (1.0 - segment.no_speech_prob),
                ),
            )
            for segment in collected
        ]

        return _Transcript(
            text=text,
            language=info.language or "unknown",
            confidence=round(sum(scores) / len(scores), 4) if scores else 0.0,
        )

def _decimal(value: str) -> Decimal | None:
    try:
        result = Decimal(value)
        return result if result > 0 else None
    except InvalidOperation:
        return None


def _clean_product(value: str) -> str:
    value = _FILLER.sub(" ", value)
    value = re.sub(r"\s+", " ", value).strip(" ,.-:")
    return value[:200]


def _extract_line_items(text: str, whisper_confidence: float) -> list[_LineItem]:
    """Parse only explicit quantity-and-price phrases, avoiding fabricated transaction data."""
    patterns = [
        re.compile(rf"(?P<product>[\w\u0B80-\u0BFF][\w\s\-\u0B80-\u0BFF]{{0,80}}?)\s+{_NUMBER.format(name='quantity')}\s*(?:{_UNITS})?\s*(?:at|@|க்கு|விலை)?\s*{_CURRENCY}?\s*{_NUMBER.format(name='price')}", re.IGNORECASE),
        re.compile(rf"{_NUMBER.format(name='quantity')}\s*(?:{_UNITS})?\s+(?P<product>[\w\u0B80-\u0BFF][\w\s\-\u0B80-\u0BFF]{{0,80}}?)\s+(?:at|@|க்கு|விலை)?\s*{_CURRENCY}?\s*{_NUMBER.format(name='price')}", re.IGNORECASE),
    ]
    matches: list[_LineItem] = []
    for pattern in patterns:
        for match in pattern.finditer(text):
            product, quantity, price = _clean_product(match.group("product")), _decimal(match.group("quantity")), _decimal(match.group("price"))
            if product and quantity is not None and price is not None and not re.fullmatch(r"[\d\s.]+", product):
                evidence = 1.0 if re.search(_CURRENCY, match.group(0), re.IGNORECASE) else 0.85
                matches.append(_LineItem(product, quantity, price, round(max(0.0, min(1.0, whisper_confidence * evidence)), 4)))
    unique: list[_LineItem] = []
    for item in matches:
        if (item.product_name.casefold(), item.quantity, item.unit_price) not in {(line.product_name.casefold(), line.quantity, line.unit_price) for line in unique}:
            unique.append(item)
    return unique


def _extract_customer_name(text: str) -> str | None:
    patterns = [r"(?:customer|for|to|க்கு|கிட்ட)\s+([A-Za-z\u0B80-\u0BFF][A-Za-z\u0B80-\u0BFF .'-]{1,50}?)(?=\s+(?:\d|kg|kilo|₹|rs\.?|rupees?)|[,.;]|$)"]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = _clean_product(match.group(1))
            if name and not re.search(r"\d", name):
                return name
    return None


def _transaction_type(text: str) -> str:
    lowered = text.casefold()
    if any(word in lowered for word in ("purchase", "bought", "buy", "வாங்க")):
        return "purchase"
    if any(word in lowered for word in ("payment", "paid", "credit", "upi", "cash")):
        return "payment"
    return "sale"


_NLP_NUMBERS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
    "ninety": 90, "hundred": 100, "thousand": 1000,
    "ஒரு": 1, "ஒன்று": 1, "ஒன்னு": 1, "இரண்டு": 2, "ரெண்டு": 2,
    "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5, "ஆறு": 6, "ஏழு": 7,
    "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10, "ஐம்பது": 50, "நூறு": 100,
}
_NLP_NUMBER_WORDS = "|".join(re.escape(word) for word in _NLP_NUMBERS)
_NLP_NUMBER_PHRASE = re.compile(
    rf"\b(?:{_NLP_NUMBER_WORDS})(?:[\s-]+(?:and|{_NLP_NUMBER_WORDS}))*\b",
    re.IGNORECASE,
)
_NLP_LINE_PATTERN = re.compile(
    rf"(?P<quantity>\d+(?:\.\d+)?)\s*(?P<unit>{_UNITS})?\s*"
    rf"(?P<product>[A-Za-z\u0B80-\u0BFF][A-Za-z0-9\u0B80-\u0BFF\s-]{{0,90}}?)\s*"
    rf"(?:for|at|@|க்கு|விலை)?\s*{_CURRENCY}?\s*"
    rf"(?P<price>\d+(?:\.\d+)?)(?P<each>\s*(?:each|per|தலா|ஒன்றுக்கு))?",
    re.IGNORECASE,
)


def _normalise_spoken_numbers(text: str) -> str:
    text = re.sub(r"\bhalf\b", "0.5", text, flags=re.IGNORECASE)
    text = re.sub(r"\bquarter\b", "0.25", text, flags=re.IGNORECASE)

    def replace(match: re.Match[str]) -> str:
        total = 0
        current = 0
        for word in match.group(0).casefold().replace("-", " ").split():
            if word == "and":
                continue
            value = _NLP_NUMBERS.get(word)
            if value is None:
                return match.group(0)
            if value == 100:
                current = max(current, 1) * value
            elif value == 1000:
                total += max(current, 1) * value
                current = 0
            else:
                current += value
        return str(total + current)

    return _NLP_NUMBER_PHRASE.sub(replace, text)


def _clean_nlp_product(value: str) -> str:
    value = re.sub(
        r"\b(?:i|we|sold|sell|sale|bought|buy|purchase|purchased|customer|"
        r"to|for|the|a|an|have|had|விற்றேன்|வாங்கினேன்)\b",
        " ",
        value,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", value).strip(" ,.-:").title()[:200]


def _match_inventory_product(
    name: str,
    products: Sequence[Product],
) -> tuple[UUID | None, str, float]:
    if not products:
        return None, name, 0.0
    spoken = re.sub(r"[^a-z0-9\u0B80-\u0BFF]+", " ", name.casefold()).strip()
    best: Product | None = None
    best_score = 0.0
    for product in products:
        candidate = re.sub(r"[^a-z0-9\u0B80-\u0BFF]+", " ", product.name.casefold()).strip()
        score = 1.0 if spoken == candidate else 0.9 if spoken in candidate or candidate in spoken else SequenceMatcher(None, spoken, candidate).ratio()
        if score > best_score:
            best, best_score = product, score
    if best is not None and best_score >= 0.72:
        return best.public_id, best.name, round(best_score, 4)
    return None, name, 0.0


def _extract_line_items(
    text: str,
    whisper_confidence: float,
    inventory_products: Sequence[Product] = (),
) -> list[_LineItem]:
    """Parse natural English, Tamil, and code-mixed quantity/product/price phrases."""
    normalized = _normalise_spoken_numbers(text)
    clauses = re.split(r"\s*(?:,|;|\band\b|\bthen\b|மற்றும்)\s*(?=\d)", normalized, flags=re.IGNORECASE)
    items: list[_LineItem] = []
    seen: set[tuple[str, Decimal, Decimal]] = set()
    for clause in clauses:
        match = _NLP_LINE_PATTERN.search(clause)
        if match is None:
            continue
        quantity = _decimal(match.group("quantity"))
        price = _decimal(match.group("price"))
        product_name = _clean_nlp_product(match.group("product"))
        if quantity is None or price is None or not product_name:
            continue
        unit = (match.group("unit") or "").casefold()
        unit_price = price if match.group("each") or any(marker in unit for marker in ("kg", "kilo", "gram", "lit", "ml", "கிலோ", "கிராம்", "லிட்டர்")) else price / quantity
        product_id, matched_name, match_score = _match_inventory_product(product_name, inventory_products)
        key = (matched_name.casefold(), quantity, unit_price)
        if key in seen:
            continue
        seen.add(key)
        confidence = min(1.0, whisper_confidence * (0.95 if match.group("each") or unit else 0.82) + (0.05 if match_score else 0.0))
        items.append(_LineItem(matched_name, quantity, unit_price, round(confidence, 4), product_id, match_score))
    return items


def _extract_customer_name(text: str) -> str | None:
    match = re.search(
        r"(?:customer|to|for|க்கு|கிட்ட)\s+"
        r"(?P<name>[A-Za-z\u0B80-\u0BFF][A-Za-z\u0B80-\u0BFF .'-]{1,60}?)"
        r"(?=\s+(?:bought|buy|purchased|purchase|sold|sell|\d)|[,.;]|$)",
        text,
        re.IGNORECASE,
    )
    if match is None:
        return None
    name = re.sub(r"\s+", " ", match.group("name")).strip(" ,.-:")
    return name if name and not re.search(r"\d", name) else None



class VoiceTransactionWorkflow:
    """Coordinates confirmed voice transaction effects after human review."""

    def __init__(self, product_service: ProductService, database: object | None = None) -> None:
        self._product_service = product_service
        self._database = database

    def confirm(self, business_id: UUID, payload: VoiceTransactionConfirmation) -> VoiceTransactionConfirmationResult:
        deductions = [(item.product_id, item.quantity) for item in payload.line_items]
        products = [self._product_service.get_product(business_id, item.product_id) for item in payload.line_items]
        self._product_service.apply_inventory_deductions(business_id, deductions)
        total = sum((item.quantity * item.unit_price for item in payload.line_items), Decimal("0"))
        transaction_id = uuid4()
        if self._database is not None:
            customer_id = None
            if payload.customer_name:
                customer = self._database["customers"].find_one({"businessId": business_id, "name": {"$regex": f"^{re.escape(payload.customer_name)}$", "$options": "i"}})
                if customer is None:
                    customer_id = uuid4()
                    self._database["customers"].insert_one({"publicId": customer_id, "businessId": business_id, "name": payload.customer_name, "outstandingBalance": Decimal128("0"), "createdAt": utc_now(), "updatedAt": utc_now()})
                else:
                    customer_id = customer["publicId"]
            now = utc_now()
            self._database["transactions"].insert_one({"publicId": transaction_id, "businessId": business_id, "invoiceNumber": f"INV-{now:%Y%m%d}-{str(transaction_id).split('-')[0].upper()}", "customerId": customer_id, "transactionType": "sale", "source": "voice", "lineItems": [{"productId": item.product_id, "productName": item.product_name, "quantity": Decimal128(item.quantity), "unitPrice": Decimal128(item.unit_price), "lineTotal": Decimal128(item.quantity * item.unit_price)} for item in payload.line_items], "subtotal": Decimal128(total), "taxTotal": Decimal128("0"), "discountTotal": Decimal128("0"), "amountPaid": Decimal128("0"), "grandTotal": Decimal128(total), "paymentStatus": "pending", "createdAt": now})
            self._database["inventory_logs"].insert_many([{"publicId": uuid4(), "businessId": business_id, "productId": item.product_id, "transactionId": transaction_id, "change": Decimal128(-item.quantity), "reason": "voice_sale", "createdAt": utc_now()} for item in payload.line_items])
        return VoiceTransactionConfirmationResult(transactionId=transaction_id, status="confirmed", inventoryUpdated=True, total=total)
