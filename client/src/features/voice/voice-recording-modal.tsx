import { CheckCircle2, ChevronLeft, CircleAlert, Mic, Send, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listProducts } from "@/features/inventory/api";
import type { ProductSummary } from "@/features/inventory/types";

import { confirmVoiceTransaction, processVoiceTransaction, voiceErrorMessage, type VoiceExtraction } from "./api";

type Phase = "ready" | "requesting" | "recording" | "processing" | "review" | "confirming" | "success" | "error";

const processingStages = ["Transcribing Speech", "Understanding Transaction", "Matching Products", "Updating Inventory", "Updating Customer Ledger", "Generating Business Insights"];

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function VoiceRecordingModal({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState(0);
  const [extraction, setExtraction] = useState<VoiceExtraction | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const cleanUpMedia = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanUpMedia(), [cleanUpMedia]);

  const close = () => {
    cleanUpMedia();
    setPhase("ready"); setElapsed(0); setStage(0); setExtraction(null); setError(null);
    onOpenChange(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording is not supported by this browser. Try a recent Chrome, Edge, or Safari version."); setPhase("error"); return;
    }
    setPhase("requesting"); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        cleanUpMedia();
        void processRecording(audio);
      };
      recorder.start(); recorderRef.current = recorder;
      setElapsed(0); setPhase("recording");
      timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (requestError) {
      const name = requestError instanceof DOMException ? requestError.name : "";
      setError(name === "NotAllowedError" ? "Microphone permission was denied. Enable it in your browser settings and try again." : "We could not access your microphone. Please try again.");
      setPhase("error");
    }
  };

  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };

  const processRecording = async (audio: Blob) => {
    setPhase("processing"); setStage(0);
    const stageTimer = window.setInterval(() => setStage((value) => Math.min(value + 1, processingStages.length - 1)), 520);
    try {
      const result = await processVoiceTransaction(audio);
      let availableProducts: ProductSummary[] = [];
      try { availableProducts = await listProducts(); } catch { /* Product matching remains editable if inventory is unavailable. */ }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const matchedLines = result.lineItems.map((line) => {
        const match = availableProducts.find((product) => product.name.toLocaleLowerCase() === line.productName.toLocaleLowerCase());
        return match ? { ...line, productId: match.id, productName: match.name, unitPrice: match.sellingPrice } : line;
      });
      setExtraction({ ...result, lineItems: matchedLines }); setProducts(availableProducts); setPhase("review");
    } catch (requestError) { setError(voiceErrorMessage(requestError)); setPhase("error"); } finally { window.clearInterval(stageTimer); }
  };

  const processBypassText = async (text: string) => {
    if (!text.trim()) return;
    setPhase("processing"); setStage(0);
    const stageTimer = window.setInterval(() => setStage((value) => Math.min(value + 1, processingStages.length - 1)), 300);
    try {
      const result = await processVoiceTransaction(null, text);
      let availableProducts: ProductSummary[] = [];
      try { availableProducts = await listProducts(); } catch { /* Product matching remains editable if inventory is unavailable. */ }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const matchedLines = result.lineItems.map((line) => {
        const match = availableProducts.find((product) => product.name.toLocaleLowerCase() === line.productName.toLocaleLowerCase());
        return match ? { ...line, productId: match.id, productName: match.name, unitPrice: match.sellingPrice } : line;
      });
      setExtraction({ ...result, lineItems: matchedLines }); setProducts(availableProducts); setPhase("review");
    } catch (requestError) { setError(voiceErrorMessage(requestError)); setPhase("error"); } finally { window.clearInterval(stageTimer); }
  };

  const updateLine = (index: number, key: "productId" | "quantity" | "unitPrice", value: string) => {
    setExtraction((current) => current ? { ...current, lineItems: current.lineItems.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value, ...(key === "productId" ? { productName: products.find((product) => product.id === value)?.name ?? line.productName } : {}) } : line) } : current);
  };

  const updateCustomer = (customerName: string) => setExtraction((current) => current ? { ...current, customerName } : current);

  const confirm = async () => {
    if (!extraction) return;
    if (extraction.lineItems.some((line) => !line.productId)) { setError("Match every line item to an inventory product before confirming."); return; }
    setPhase("confirming"); setError(null);
    try {
      await confirmVoiceTransaction({ customerName: extraction.customerName, lineItems: extraction.lineItems.map(({ productId, productName, quantity, unitPrice }) => ({ productId, productName, quantity, unitPrice })) });
      setPhase("success");
    } catch (requestError) { setError(voiceErrorMessage(requestError)); setPhase("review"); }
  };

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}><DialogContent className="h-[100dvh] max-h-none w-full max-w-none rounded-none border-0 bg-slate-950 p-0 text-white"><DialogTitle className="sr-only">Voice transaction</DialogTitle><button type="button" onClick={close} className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close voice transaction"><X size={20} /></button>
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-8 sm:px-10">{phase === "ready" || phase === "requesting" || phase === "recording" ? <RecorderScreen phase={phase} elapsed={elapsed} onStart={() => void startRecording()} onStop={stopRecording} onBypassSubmit={processBypassText} /> : null}{phase === "processing" ? <ProcessingScreen stage={stage} /> : null}{phase === "review" && extraction ? <ReviewScreen extraction={extraction} products={products} error={error} onBack={() => { setPhase("ready"); setExtraction(null); }} onUpdateLine={updateLine} onUpdateCustomer={updateCustomer} onConfirm={() => void confirm()} /> : null}{phase === "confirming" ? <ProcessingScreen stage={3} title="Recording your transaction" subtitle="Updating stock and business records safely." /> : null}{phase === "success" ? <SuccessScreen onDone={close} /> : null}{phase === "error" ? <ErrorScreen message={error ?? "Something went wrong."} onRetry={() => { setPhase("ready"); setError(null); }} /> : null}</div>
  </DialogContent></Dialog>;
}

function RecorderScreen({ phase, elapsed, onStart, onStop, onBypassSubmit }: { phase: Phase; elapsed: number; onStart: () => void; onStop: () => void; onBypassSubmit: (text: string) => void }) {
  const recording = phase === "recording";
  const [bypassText, setBypassText] = useState("");

  const handleBypass = (e: React.FormEvent) => {
    e.preventDefault();
    if (bypassText.trim()) {
      onBypassSubmit(bypassText.trim());
    }
  };

  return <div className="flex flex-1 flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Sparkles size={27} /></span><p className="mt-7 text-sm font-semibold text-violet-300">KHATAFLOW VOICE</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{recording ? "I’m listening." : "Tell me what happened."}</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-400 sm:text-base">{recording ? "Speak naturally — sales, purchases and customer payments all work." : "Say a transaction in your own words. I’ll turn it into an organised record."}</p><Waveform active={recording} /><p className="mt-6 font-mono text-2xl font-semibold tracking-widest text-white">{formatDuration(elapsed)}</p><p className="mt-2 text-sm text-slate-500">{recording ? "Recording securely on this device" : phase === "requesting" ? "Requesting microphone access…" : "Your audio is only sent when you stop recording."}</p>{recording ? <Button className="mt-10 h-14 rounded-full bg-red-500 px-7 text-base hover:bg-red-600" onClick={onStop}><Square className="mr-2 fill-current" size={18} />Stop & analyse</Button> : <div className="mt-8 flex flex-col items-center gap-6 w-full max-w-md"><Button className="h-14 rounded-full bg-violet-600 px-7 text-base hover:bg-violet-500 w-fit" disabled={phase === "requesting"} onClick={onStart}><Mic className="mr-2" size={20} />{phase === "requesting" ? "Connecting…" : "Start speaking"}</Button><form onSubmit={handleBypass} className="w-full flex gap-2 border border-white/10 bg-white/5 p-2 rounded-xl mt-2"><Input className="border-0 bg-transparent text-white placeholder:text-slate-500 h-10 text-sm focus-visible:ring-0" placeholder="Or type what happened here..." value={bypassText} onChange={(e) => setBypassText(e.target.value)} /><Button type="submit" className="bg-violet-600 hover:bg-violet-500 h-10 px-4 text-xs font-semibold">Analyze Text</Button></form></div>}</div>;
}

function Waveform({ active }: { active: boolean }) { return <div className="mt-12 flex h-20 items-center justify-center gap-1.5">{Array.from({ length: 17 }, (_, index) => <span key={index} className={`w-1.5 rounded-full bg-violet-400 transition-all ${active ? "animate-pulse" : "h-2 opacity-30"}`} style={active ? { height: `${20 + ((index * 17) % 55)}px`, animationDelay: `${index * 65}ms` } : undefined} />)}</div>; }

function ProcessingScreen({ stage, title = "KhataFlow is working", subtitle = "I’m turning your words into a clear business record." }: { stage: number; title?: string; subtitle?: string }) { return <div className="flex flex-1 flex-col justify-center"><div className="mx-auto w-full max-w-md"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><Sparkles className="animate-pulse" size={30} /></div><p className="mt-8 text-sm font-semibold text-violet-300">AI AT WORK</p><h2 className="mt-3 text-3xl font-bold tracking-tight">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p><div className="mt-10 space-y-3">{processingStages.map((item, index) => <div key={item} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${index < stage ? "bg-emerald-500/10 text-emerald-300" : index === stage ? "bg-white/10 text-white" : "text-slate-600"}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${index < stage ? "bg-emerald-400 text-emerald-950" : index === stage ? "bg-violet-400 text-violet-950 animate-pulse" : "bg-slate-800"}`}>{index < stage ? <CheckCircle2 size={15} /> : index + 1}</span>{item}</div>)}</div></div></div>; }

function ReviewScreen({ extraction, products, error, onBack, onUpdateLine, onUpdateCustomer, onConfirm }: { extraction: VoiceExtraction; products: ProductSummary[]; error: string | null; onBack: () => void; onUpdateLine: (index: number, key: "productId" | "quantity" | "unitPrice", value: string) => void; onUpdateCustomer: (value: string) => void; onConfirm: () => void }) { const total = extraction.lineItems.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0); return <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col py-4"><button type="button" onClick={onBack} className="inline-flex w-fit items-center text-sm font-semibold text-slate-400 hover:text-white"><ChevronLeft size={16} />Record again</button><p className="mt-7 text-sm font-semibold text-violet-300">AI DRAFT · {Math.round(extraction.overallConfidence * 100)}% CONFIDENT</p><h2 className="mt-2 text-3xl font-bold">Review your transaction</h2><p className="mt-2 text-sm leading-6 text-slate-400">“{extraction.transcript}”</p><div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</label><Input className="mt-2 border-white/10 bg-white/10 text-white placeholder:text-slate-500" value={extraction.customerName ?? ""} placeholder="Walk-in customer" onChange={(event) => onUpdateCustomer(event.target.value)} /><div className="mt-6 space-y-4">{extraction.lineItems.map((line, index) => <div key={`${line.productName}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Item {index + 1}</p><span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-200">{Math.round(line.confidence * 100)}% match</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_110px]"><select className="h-10 rounded-md border border-white/10 bg-slate-800 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400" value={line.productId ?? ""} onChange={(event) => onUpdateLine(index, "productId", event.target.value)}><option value="">Match a product…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><Input className="border-white/10 bg-slate-800 text-white" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => onUpdateLine(index, "quantity", event.target.value)} /><Input className="border-white/10 bg-slate-800 text-white" type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => onUpdateLine(index, "unitPrice", event.target.value)} /></div></div>)}</div><div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4"><span className="text-sm text-slate-400">Estimated total</span><span className="text-2xl font-bold">₹{total.toFixed(2)}</span></div></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-auto flex flex-col-reverse gap-3 pt-7 sm:flex-row sm:justify-end"><Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={onBack}>Edit recording</Button><Button className="bg-violet-500 hover:bg-violet-400" onClick={onConfirm}><Send className="mr-2" size={17} />Confirm & update business</Button></div></div>; }

function SuccessScreen({ onDone }: { onDone: () => void }) { return <div className="flex flex-1 flex-col items-center justify-center text-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={42} /></span><p className="mt-8 text-sm font-semibold text-emerald-300">TRANSACTION CONFIRMED</p><h2 className="mt-3 text-3xl font-bold">The back office is updated.</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-400">Inventory has been adjusted and your business record is ready.</p><Button className="mt-9 bg-white text-slate-950 hover:bg-slate-100" onClick={onDone}>Back to dashboard</Button></div>; }

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) { const guidance = message.includes("Whisper model") ? "The voice assistant needs its local Whisper model before it can hear recordings. Set WHISPER_MODEL to a mounted local model (or pre-cache the configured model), then restart the API." : "Say one item at a time, for example: “Sold 2 kg rice at 60 rupees each to Ravi.” You can then review every item before it is saved."; return <div className="flex flex-1 flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-300"><CircleAlert size={30} /></span><h2 className="mt-6 text-2xl font-bold">Let&apos;s try that again.</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-400">{message}</p><p className="mt-4 max-w-md rounded-xl bg-white/5 p-3 text-sm leading-6 text-violet-200">Voice assistant: {guidance}</p><Button className="mt-8 bg-violet-500 hover:bg-violet-400" onClick={onRetry}><Mic className="mr-2" size={17} />Try recording again</Button></div>; }

function formatDuration(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
