"""Voice transaction HTTP workflow."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.routes.inventory import get_business_id, get_product_service
from app.database.mongo import get_database
from app.services.product_service import ProductService
from app.schemas.voice import VoiceTransactionConfirmation, VoiceTransactionConfirmationResult, VoiceTransactionExtraction
from app.services.voice_service import WhisperVoiceService, VoiceService, VoiceServiceError, VoiceTransactionWorkflow

router = APIRouter(prefix="/voice", tags=["voice"])
MAX_AUDIO_BYTES = 15 * 1024 * 1024


def get_voice_workflow(product_service: ProductService = Depends(get_product_service)) -> VoiceTransactionWorkflow:
    return VoiceTransactionWorkflow(product_service, get_database())


def get_voice_service(
    business_id: UUID = Depends(get_business_id),
    product_service: ProductService = Depends(get_product_service),
) -> VoiceService:
    try:
        inventory_products, _ = product_service.list_products(
            business_id,
            query=None,
            category=None,
            include_inactive=False,
        )
        return WhisperVoiceService(inventory_products)
    except VoiceServiceError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.post("/transaction", status_code=status.HTTP_200_OK)
async def extract_voice_transaction(
    audio: UploadFile | None = File(default=None),
    text_override: str | None = Form(default=None, alias="textOverride"),
    voice_service: VoiceService = Depends(get_voice_service),
) -> dict[str, VoiceTransactionExtraction]:
    if text_override:
        try:
            return {"data": voice_service.extract_transaction(b"", None, text_override=text_override)}
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    if not audio:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either an audio recording or text override is required.")

    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="An audio file is required.")
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio must be 15 MB or smaller.")
    try:
        return {"data": voice_service.extract_transaction(content, audio.content_type)}
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@router.post("/transaction/confirm", status_code=status.HTTP_201_CREATED)
def confirm_voice_transaction(
    payload: VoiceTransactionConfirmation,
    business_id: UUID = Depends(get_business_id),
    workflow: VoiceTransactionWorkflow = Depends(get_voice_workflow),
) -> dict[str, VoiceTransactionConfirmationResult]:
    return {"data": workflow.confirm(business_id, payload)}
