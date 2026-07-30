import axios from "axios";
import { api } from "@/lib/api";

export type VoiceLineItem = { productId: string | null; productName: string; quantity: string; unitPrice: string; confidence: number };
export type VoiceExtraction = { transcript: string; customerName: string | null; lineItems: VoiceLineItem[]; total: string; overallConfidence: number; metadata: Record<string, unknown> };
export type VoiceConfirmation = { customerName: string | null; lineItems: Array<Pick<VoiceLineItem, "productId" | "productName" | "quantity" | "unitPrice">> };
export type VoiceConfirmationResult = { transactionId: string; status: string; inventoryUpdated: boolean; total: string };

export async function processVoiceTransaction(audio: Blob | null, textOverride?: string): Promise<VoiceExtraction> {
  const form = new FormData();
  if (audio) {
    form.append("audio", audio, "khataflow-voice-note.webm");
  }
  if (textOverride) {
    form.append("textOverride", textOverride);
  }
  return (await api.post<{ data: VoiceExtraction }>("/voice/transaction", form)).data.data;
}

export async function confirmVoiceTransaction(payload: VoiceConfirmation): Promise<VoiceConfirmationResult> {
  return (await api.post<{ data: VoiceConfirmationResult }>("/voice/transaction/confirm", payload)).data.data;
}

export function voiceErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message ?? error.response?.data?.detail ?? "KhataFlow could not process that recording.";
  return "KhataFlow could not process that recording.";
}
