"""Twilio WhatsApp sending service using the REST API directly.

Uses the requests library instead of the Twilio SDK to avoid
dependency conflicts. Sends automatic payment reminders via WhatsApp.
Falls back gracefully when credentials are not configured.
"""

import logging
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


@dataclass
class WhatsAppResult:
    sent: bool
    message_sid: str | None = None
    error: str | None = None


class WhatsAppService:
    """Sends WhatsApp messages via Twilio REST API (no SDK needed)."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str) -> None:
        self._sid = account_sid
        self._token = auth_token
        self._from = from_number
        self._url = f"{TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json"

    def send_payment_reminder(
        self,
        *,
        to_phone: str,
        customer_name: str,
        outstanding: str,
        business_name: str,
        payment_link: str,
    ) -> WhatsAppResult:
        """Send a payment reminder WhatsApp message to a customer."""

        # Normalise phone to E.164 format
        digits = "".join(c for c in to_phone if c.isdigit())
        if not digits:
            return WhatsAppResult(sent=False, error="Customer has no phone number.")

        # Add India country code if 10-digit number given
        if len(digits) == 10:
            digits = "91" + digits

        to_wa = f"whatsapp:+{digits}"

        body = (
            f"Hello {customer_name},\n\n"
            f"This is a payment reminder from *{business_name}*.\n\n"
            f"Your outstanding balance is *\u20b9{outstanding}*.\n\n"
            f"Pay securely via UPI:\n{payment_link}\n\n"
            f"Thank you for your business! \U0001f64f"
        )

        try:
            response = requests.post(
                self._url,
                data={"From": self._from, "To": to_wa, "Body": body},
                auth=(self._sid, self._token),
                timeout=15,
            )
            data = response.json()

            if response.status_code in (200, 201):
                sid = data.get("sid", "")
                logger.info("WhatsApp sent to %s — SID %s", to_wa, sid)
                return WhatsAppResult(sent=True, message_sid=sid)
            else:
                error_msg = data.get("message", f"HTTP {response.status_code}")
                logger.error("WhatsApp failed to %s: %s", to_wa, error_msg)
                return WhatsAppResult(sent=False, error=error_msg)

        except requests.Timeout:
            logger.error("WhatsApp send timed out to %s", to_wa)
            return WhatsAppResult(sent=False, error="Request timed out.")
        except Exception as exc:
            logger.exception("WhatsApp send failed to %s", to_wa)
            return WhatsAppResult(sent=False, error=str(exc))


def get_whatsapp_service() -> "WhatsAppService | None":
    """Return a configured WhatsAppService if Twilio credentials are present."""
    from app.config import get_settings
    s = get_settings()
    if not s.twilio_enabled:
        return None
    return WhatsAppService(
        account_sid=s.twilio_account_sid,   # type: ignore[arg-type]
        auth_token=s.twilio_auth_token,     # type: ignore[arg-type]
        from_number=s.twilio_whatsapp_from,
    )
