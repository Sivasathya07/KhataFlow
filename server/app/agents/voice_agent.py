"""Voice workflows use the existing review-before-confirmation endpoint."""
from app.services.voice_service import WhisperVoiceService
VoiceAgent = WhisperVoiceService
