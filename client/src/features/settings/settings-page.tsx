import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Settings, Building, QrCode, Key, Eye, EyeOff,
  Sun, Moon, Laptop, CheckCircle2, AlertCircle, LoaderCircle,
} from "lucide-react";

export function SettingsPage() {
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("system");
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [businessUpiName, setBusinessUpiName] = useState("");
  const [businessWhatsapp, setBusinessWhatsapp] = useState("");
  const [llmProvider, setLlmProvider] = useState("none");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiApiBase, setOpenaiApiBase] = useState("");
  const [openaiModel, setOpenaiModel] = useState("llama-3.3-70b-versatile");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyTheme = (t: string) => {
    localStorage.setItem("khataflow_theme", t);
    const root = document.documentElement;
    root.dataset.theme = t;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  };

  useEffect(() => {
    void api.get<{ data: {
      name: string; logoUrl: string | null; gstNumber: string | null; currency: string; language: string;
      theme: string; backupEnabled: boolean; upiId?: string; businessUpiName?: string; businessWhatsapp?: string;
      openaiApiKey?: string; openaiApiBase?: string; openaiModel?: string; llmProvider?: string;
    }}>("/settings").then((res) => {
      const s = res.data.data;
      setName(s.name || ""); setLogoUrl(s.logoUrl || ""); setGstNumber(s.gstNumber || "");
      setCurrency(s.currency || "INR"); setLanguage(s.language || "en"); setTheme(s.theme || "system");
      setBackupEnabled(s.backupEnabled || false); setUpiId(s.upiId || "");
      setBusinessUpiName(s.businessUpiName || ""); setBusinessWhatsapp(s.businessWhatsapp || "");
      setOpenaiApiKey(s.openaiApiKey || ""); setOpenaiApiBase(s.openaiApiBase || "");
      setOpenaiModel(s.openaiModel || "llama-3.3-70b-versatile"); setLlmProvider(s.llmProvider || "none");
      applyTheme(s.theme || "system");
    }).catch(() => setError("Could not load settings.")).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try {
      await api.patch("/settings", {
        name, logoUrl: logoUrl || null, gstNumber: gstNumber || null, currency, language, theme,
        backupEnabled, upiId: upiId || null, businessUpiName: businessUpiName || null,
        businessWhatsapp: businessWhatsapp || null, openaiApiKey: openaiApiKey || null,
        openaiApiBase: openaiApiBase || null, openaiModel: openaiModel || null,
      });
      applyTheme(theme);
      setMessage("Settings saved successfully.");
    } catch { setError("Failed to save settings."); }
    finally { setSaving(false); }
  };

  const fieldClass = "h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]";

  return (
    <main className="page-shell">
      <div className="mb-6">
        <p className="eyebrow flex items-center gap-1.5"><Settings size={12} /> Settings</p>
        <h1 className="page-title">Preferences & Workspace</h1>
        <p className="page-subtitle">Configure your business identity, UPI, AI, and visual settings.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-[var(--muted)]">
          <LoaderCircle className="animate-spin mr-2" size={24} /> Loading preferences…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5 max-w-4xl">
          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /><span>{message}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle size={16} className="text-red-600 shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* Business Identity */}
          <Card className="surface-panel p-6">
            <h2 className="mb-4 font-semibold flex items-center gap-2 text-[var(--ink)]">
              <Building className="text-[var(--accent)]" size={18} /> Business Profile
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Business Name *</label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Shop Name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">GST Number</label>
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="27AAAAA1111A1Z1" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Logo URL</label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://host.com/logo.png" />
              </div>
            </div>
          </Card>

          {/* UPI */}
          <Card className="surface-panel p-6">
            <h2 className="mb-4 font-semibold flex items-center gap-2 text-[var(--ink)]">
              <QrCode className="text-[var(--accent)]" size={18} /> UPI & Payments
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">UPI ID</label>
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="mybusiness@upi" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Business UPI Name</label>
                <Input value={businessUpiName} onChange={(e) => setBusinessUpiName(e.target.value)} placeholder="Satyam Groceries" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Shop WhatsApp Number</label>
                <Input value={businessWhatsapp} onChange={(e) => setBusinessWhatsapp(e.target.value)} placeholder="9198XXXXXXXX" />
                <p className="text-xs text-[var(--muted)]">Payment reminders open WhatsApp to the customer's phone. No Meta API needed.</p>
              </div>
            </div>
          </Card>

          {/* AI */}
          <Card className="surface-panel p-6">
            <h2 className="mb-1 font-semibold flex items-center gap-2 text-[var(--ink)]">
              <Key className="text-[var(--accent)]" size={18} /> AI Assistant
            </h2>
            <p className="mb-4 text-xs text-[var(--muted)]">
              Active provider: <span className="font-semibold text-[var(--accent-strong)]">{llmProvider}</span>.
              Preferred: set <code className="bg-[var(--paper-strong)] px-1 rounded text-[var(--ink)]">GROQ_API_KEY</code> in server/.env.
              The fields below are an optional per-tenant override.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">API Key (sk-… or gsk_…)</label>
                <div className="relative">
                  <Input type={showKey ? "text" : "password"} value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="Leave blank to use server/.env key"
                    className="pr-10" />
                  <button type="button" onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]">
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Base URL</label>
                <Input value={openaiApiBase} onChange={(e) => setOpenaiApiBase(e.target.value)} placeholder="https://api.groq.com/openai/v1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Model</label>
                <Input value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} placeholder="llama-3.3-70b-versatile" />
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="surface-panel p-6">
            <h2 className="mb-4 font-semibold flex items-center gap-2 text-[var(--ink)]">
              <Settings className="text-[var(--accent)]" size={18} /> Display & Regional
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-[var(--muted)] mb-2">Theme</label>
                <div className="flex rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] overflow-hidden">
                  {[{ id: "light", icon: Sun, label: "Light" }, { id: "dark", icon: Moon, label: "Dark" }, { id: "system", icon: Laptop, label: "Auto" }].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.id} type="button" onClick={() => setTheme(opt.id)}
                        className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition ${
                          theme === opt.id
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--ink)]"
                        }`}>
                        <Icon size={14} className="mb-1" />{opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Currency</label>
                <select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Language</label>
                <select className={fieldClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="ta">Tamil</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <div className="flex items-center gap-3 sm:col-span-3">
                <input id="backup" type="checkbox" checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]" />
                <label htmlFor="backup" className="text-sm text-[var(--ink)]">Enable automatic daily backup</label>
              </div>
            </div>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} className="h-11 px-10 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
