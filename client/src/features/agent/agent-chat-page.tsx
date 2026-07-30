import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, Send, ShoppingBag, CheckCircle, LoaderCircle,
  ArrowRight, Mic, MicOff, Volume2, VolumeX, Square,
} from "lucide-react";
import { listProducts } from "@/features/inventory/api";
import type { ProductSummary } from "@/features/inventory/types";

interface Message {
  role: "user" | "assistant";
  text: string;
  proposal?: {
    transactionType: "sale" | "purchase" | "return";
    customerName: string | null;
    lineItems: Array<{ productName: string; quantity: number; unitPrice: number }>;
  } | null;
  confirmed?: boolean;
}

/* ── Browser Speech API helpers ─────────────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
const SpeechRecognition: any =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

function isTamilContent(text: string): boolean {
  if (/[\u0B80-\u0BFF]/.test(text)) return true;
  const keywords = /\b(tamil|tamizh|thamizh|tanglish|enna|evvalo|evalo|iruka|irukka|irukku|sollu|sollunga|pesu|pesunga|kadan|panam|kasu|kaasu|vithu|vanga|vaanga|nikuthu|varum|yar|yaar|indru|inaiku|iniku|vanakkam|vanakam|nandri|kuduthu|koduthu|rubai|roopai|aachu|seri|aama|illai|ille|kammi|jaasthi|vikanum|vanganum|pannanum|tharen|vangonga|sollinga|enaku|enakku|unaku|unakku)\b/i;
  return keywords.test(text);
}

let currentAudioFallback: HTMLAudioElement | null = null;

function stopSpeakingGlobal() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (currentAudioFallback) {
    currentAudioFallback.pause();
    currentAudioFallback.currentTime = 0;
    currentAudioFallback = null;
  }
}

function speakTamilFallback(text: string, onEnd?: () => void) {
  stopSpeakingGlobal();
  try {
    const clean = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/[*#`_~]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      onEnd?.();
      return;
    }

    // Split text into chunks of <= 90 characters for high quality Google TTS synthesis
    const rawChunks = clean.split(/(?<=[.?!,;:\n])\s+/);
    const chunks: string[] = [];
    const maxLen = 90;

    for (const item of rawChunks) {
      if (item.length <= maxLen) {
        if (item.trim()) chunks.push(item.trim());
      } else {
        const parts = item.match(new RegExp(`.{1,${maxLen}}`, "g")) || [item];
        for (const p of parts) {
          if (p.trim()) chunks.push(p.trim());
        }
      }
    }

    if (chunks.length === 0) {
      onEnd?.();
      return;
    }

    let i = 0;

    const playChunk = () => {
      if (i >= chunks.length) {
        currentAudioFallback = null;
        if (onEnd) onEnd();
        return;
      }

      const currentText = chunks[i];
      i++;

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ta&client=gtx&q=${encodeURIComponent(currentText)}`;
      const audio = new Audio(url);
      currentAudioFallback = audio;

      audio.onended = () => playChunk();
      audio.onerror = () => playChunk();
      audio.play().catch(() => playChunk());
    };

    playChunk();
  } catch {
    if (onEnd) onEnd();
  }
}

function speakText(text: string, lang: "english" | "tamil" | "tanglish" = "english", onEnd?: () => void) {
  stopSpeakingGlobal();
  
  // Strip markdown bold/italic, code blocks, URLs and emojis for cleaner TTS
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();

  if (!clean) {
    onEnd?.();
    return;
  }

  const isTamil = lang === "tamil" || lang === "tanglish" || isTamilContent(clean);

  if (isTamil) {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const tamilVoice = voices.find((v) => {
      const l = v.lang.toLowerCase().replace("_", "-");
      const n = v.name.toLowerCase();
      return l.startsWith("ta") || n.includes("tamil") || v.name.includes("தமிழ்") || n.includes("valluvar") || n.includes("pallavi");
    });

    // ONLY use Web Speech API if an actual explicit Tamil voice is installed on the machine
    if (tamilVoice && window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang = tamilVoice.lang || "ta-IN";
      utt.voice = tamilVoice;
      utt.rate = 0.9;
      utt.pitch = 1.0;
      utt.volume = 1.0;

      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          onEnd?.();
        }
      };

      utt.onend = done;
      utt.onerror = () => speakTamilFallback(clean, done);
      window.speechSynthesis.speak(utt);
      return;
    }

    // Otherwise use our reliable chunked Google Translate Tamil TTS audio engine
    speakTamilFallback(clean, onEnd);
  } else {
    if (!window.speechSynthesis) {
      onEnd?.();
      return;
    }
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "en-IN";
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((v) => v.lang.toLowerCase().replace("_", "-") === "en-in") ||
      voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("google")) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) utt.voice = englishVoice;

    if (onEnd) {
      utt.onend = onEnd;
      utt.onerror = () => onEnd();
    }
    window.speechSynthesis.speak(utt);
  }
}

export function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm your KhataFlow AI assistant. You can type or speak your question in English or Tamil. Ask about stock, sales, customers, or say something like — Sell 2 kg rice to Anita or Stock evvalo iruku?",
    },
  ]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [sending, setSending] = useState(false);
  const [products, setProducts] = useState<ProductSummary[]>([]);

  // Voice input state
  const [listening, setListening] = useState(false);
  const [wasVoiceInput, setWasVoiceInput] = useState(false);
  const [voiceSupported] = useState(() => Boolean(SpeechRecognition));
  const recognizerRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const [interimText, setInterimText] = useState("");
  const [detectedLang, setDetectedLang] = useState<"english" | "tamil" | "tanglish">("english");

  // Voice output state
  const [voiceOut, setVoiceOut] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void listProducts().then(setProducts).catch(() => {});
    // Load voices
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

  // ── Voice Input ──────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "ta-IN";          // Primary: Tamil
    rec.continuous = false;
    rec.interimResults = true;
    try {
      const grammar = new (window as any).SpeechGrammarList();
      grammar.addFromString("#JSGF V1.0; grammar lang; public <lang> = ta-IN | en-IN;", 1);
      rec.grammars = grammar;
    } catch { /* ignore if not supported */ }

    rec.onstart = () => {
      setListening(true);
      setWasVoiceInput(true);
    };

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) { setText(final); setInterimText(""); }
      else setInterimText(interim);
    };

    rec.onerror = (e: any) => {
      if (e.error === "language-not-supported" || e.error === "no-speech") {
        const rec2 = new SpeechRecognition();
        rec2.lang = "en-IN";
        rec2.continuous = false;
        rec2.interimResults = true;
        rec2.onresult = (e2: any) => {
          let interim = "";
          let final = "";
          for (let i = e2.resultIndex; i < e2.results.length; i++) {
            const t = e2.results[i][0].transcript;
            if (e2.results[i].isFinal) final += t;
            else interim += t;
          }
          if (final) { setText(final); setInterimText(""); }
          else setInterimText(interim);
        };
        rec2.onerror = () => { setListening(false); setInterimText(""); };
        rec2.onend = () => { setListening(false); setInterimText(""); };
        recognizerRef.current = rec2;
        rec2.start();
        return;
      }
      setListening(false);
      setInterimText("");
    };
    rec.onend = () => { setListening(false); setInterimText(""); };

    recognizerRef.current = rec;
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
    setInterimText("");
  }, []);

  const toggleListen = () => {
    if (listening) stopListening();
    else startListening();
  };

  const stopSpeaking = () => {
    stopSpeakingGlobal();
    setSpeaking(false);
  };

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || sending) return;
    const isInputTamil = wasVoiceInput || isTamilContent(query);
    setWasVoiceInput(false);
    setText("");
    setInterimText("");
    setSending(true);
    setMessages((cur) => [...cur, { role: "user", text: query.trim() }]);

    try {
      const res = await api.post<{
        data: {
          conversationId: string;
          reply: string;
          detectedLanguage?: "english" | "tamil" | "tanglish";
          proposal?: Message["proposal"];
        };
      }>("/agent/chat", {
        message: query.trim(),
        conversationId,
        preferredLanguage: isInputTamil ? "tamil" : undefined,
      });

      const reply = res.data.data.reply;
      let lang = res.data.data.detectedLanguage ?? (isInputTamil ? "tamil" : "english");
      if (isInputTamil || isTamilContent(reply) || isTamilContent(query)) {
        lang = "tamil";
      }
      setDetectedLang(lang);
      setConversationId(res.data.data.conversationId);
      setMessages((cur) => [
        ...cur,
        { role: "assistant", text: reply, proposal: res.data.data.proposal },
      ]);

      if (voiceOut) {
        setSpeaking(true);
        speakText(reply, lang, () => setSpeaking(false));
      }
    } catch {
      const errMsg = isInputTamil
        ? "உதவியாளரைத் தொடர்பு கொள்ள முடியவில்லை. API இயங்குகிறதா என்று சரிபார்க்கவும்."
        : "I couldn't reach the assistant. Check that the API is running and GROQ_API_KEY is set in server/.env.";
      setMessages((cur) => [...cur, { role: "assistant", text: errMsg }]);
      if (voiceOut) {
        setSpeaking(true);
        speakText(errMsg, isInputTamil ? "tamil" : "english", () => setSpeaking(false));
      }
    } finally {
      setSending(false);
    }
  }, [conversationId, sending, voiceOut, wasVoiceInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(text);
  };

  // Auto-send when voice input finishes (user stopped speaking)
  useEffect(() => {
    if (!listening && text && wasVoiceInput && !sending) {
      const timer = setTimeout(() => {
        void sendMessage(text);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [listening, text, wasVoiceInput, sending, sendMessage]);

  // ── Confirm proposal ─────────────────────────────────────────
  const handleConfirm = async (index: number, proposal: NonNullable<Message["proposal"]>) => {
    const items = proposal.lineItems.map((item) => {
      const match = products.find((p) => p.name.toLowerCase() === item.productName.toLowerCase());
      return {
        productId: match?.id ?? products[0]?.id ?? "",
        productName: match?.name ?? item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    });
    try {
      setMessages((cur) => cur.map((m, i) => (i === index ? { ...m, confirmed: false } : m)));
      await api.post("/voice/transaction/confirm", { customerName: proposal.customerName, lineItems: items });
      setMessages((cur) => cur.map((m, i) => (i === index ? { ...m, confirmed: true } : m)));
      if (voiceOut) {
        setSpeaking(true);
        const confirmMsg = detectedLang === "tamil" || detectedLang === "tanglish"
          ? "பரிவர்த்தனை உறுதி செய்யப்பட்டது மற்றும் ஸ்டாக் புதுப்பிக்கப்பட்டது."
          : "Transaction confirmed and stock updated.";
        speakText(confirmMsg, detectedLang, () => setSpeaking(false));
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof detail === "string" ? detail : "Failed to confirm transaction.");
    }
  };

  const suggestions = [
    "தமிழ் பேசு",
    "Stock evvalo iruku?",
    "இன்றைய விற்பனை எவ்வளவு?",
    "யார் கடன் வைத்துள்ளனர்?",
    "Sell 2 kg rice to Ravi",
    "Low stock alert",
  ];

  return (
    <main className="page-shell">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4 bg-[var(--paper-strong)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white">
              <Bot size={20} />
            </span>
            <div>
              <h1 className="font-semibold text-[var(--ink)]">KhataFlow AI Assistant</h1>
              <p className="text-xs text-[var(--muted)]">
                {listening
                  ? "🎤 Listening (Tamil / English)..."
                  : speaking
                  ? `🔊 Speaking in ${detectedLang === "tamil" || detectedLang === "tanglish" ? "Tamil" : "English"}...`
                  : `Voice enabled · ${detectedLang === "tamil" ? "🇮🇳 Tamil" : detectedLang === "tanglish" ? "🇮🇳 Tanglish" : "🇬🇧 English"}`}
              </p>
            </div>
          </div>

          {/* Voice output toggle */}
          <button
            type="button"
            onClick={() => { if (voiceOut && speaking) stopSpeaking(); setVoiceOut((v) => !v); }}
            title={voiceOut ? "Mute voice replies" : "Enable voice replies"}
            className={`rounded-full p-2 transition border ${
              voiceOut
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {voiceOut ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </header>

        {/* ── Messages ── */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: "55vh" }}>
          {messages.map((message, index) => (
            <div key={index} className="space-y-3 animate-fade-in">
              <article
                className={`max-w-[85%] rounded-xl p-3.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-auto bg-[var(--accent)] text-white"
                    : "bg-[var(--paper-strong)] text-[var(--ink)] border border-[var(--line)]"
                }`}
              >
                {/* Re-read button on assistant messages */}
                {message.role === "assistant" && voiceOut && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpeaking(true);
                      speakText(message.text, isTamilContent(message.text) ? "tamil" : detectedLang, () => setSpeaking(false));
                    }}
                    className="float-right ml-2 mt-0.5 text-[var(--muted)] hover:text-[var(--accent)]"
                    title="Read aloud"
                  >
                    <Volume2 size={13} />
                  </button>
                )}
                {message.text}
              </article>

              {/* Transaction proposal card */}
              {message.proposal && (
                <div className="max-w-[85%] rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[var(--accent-strong)]">
                    <ShoppingBag size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Draft {message.proposal.transactionType}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--ink)] space-y-1">
                    <div className="flex justify-between py-1 border-b border-[var(--line)]">
                      <span className="text-[var(--muted)]">Customer</span>
                      <span className="font-semibold">{message.proposal.customerName || "Walk-in"}</span>
                    </div>
                    {message.proposal.lineItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.productName} × {item.quantity}</span>
                        <span className="font-medium">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t border-[var(--line)] pt-2 text-[var(--ink)]">
                      <span>Total</span>
                      <span>₹{message.proposal.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</span>
                    </div>
                  </div>
                  {message.confirmed ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                      <CheckCircle size={14} /> Confirmed & stock updated
                    </div>
                  ) : (
                    <Button
                      onClick={() => message.proposal && void handleConfirm(index, message.proposal)}
                      className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs h-8"
                    >
                      Confirm & update stock <ArrowRight size={12} className="ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Interim voice text */}
          {interimText && (
            <p className="ml-auto max-w-[85%] rounded-xl bg-[var(--accent)]/60 p-3 text-sm italic text-white animate-pulse">
              {interimText}…
            </p>
          )}

          {/* Sending indicator */}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <LoaderCircle className="animate-spin" size={16} />
              <span>Thinking…</span>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* ── Suggestions ── */}
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void sendMessage(s)}
              className="rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)] transition hover:bg-[var(--panel-hover)]"
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Input bar ── */}
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--line)] p-3 bg-[var(--paper-strong)]">

          {/* Voice input button */}
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleListen}
              title={listening ? "Stop listening" : "Speak your question"}
              className={`shrink-0 rounded-xl px-3 py-2 transition font-medium text-sm flex items-center gap-1.5 ${
                listening
                  ? "bg-rose-500 text-white animate-pulse"
                  : "border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--accent)]"
              }`}
            >
              {listening ? <><MicOff size={16} /> Stop</> : <><Mic size={16} /> Speak</>}
            </button>
          )}

          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={listening ? "Listening... speak now" : "Type or speak your question..."}
            aria-label="Assistant message"
            className="border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
          />

          {/* Stop speaking button (shows when AI is talking) */}
          {speaking ? (
            <button
              type="button"
              onClick={stopSpeaking}
              title="Stop speaking"
              className="shrink-0 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-rose-600 hover:bg-rose-100"
            >
              <Square size={16} />
            </button>
          ) : (
            <Button
              type="submit"
              disabled={sending || !text.trim()}
              className="shrink-0 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white"
            >
              {sending ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
            </Button>
          )}
        </form>

        {/* Voice not supported warning */}
        {!voiceSupported && (
          <p className="px-4 pb-2 text-center text-xs text-[var(--muted)]">
            Voice input not supported in this browser. Use Chrome or Edge for voice.
          </p>
        )}
      </section>
    </main>
  );
}
