import axios from "axios";
import { AlertCircle, BarChart3, Download, FileText, LoaderCircle, Mic, Package, Settings2, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VoiceRecordingModal } from "@/features/voice/voice-recording-modal";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1" });
type PageKind = "customers" | "transactions" | "reports" | "analytics" | "invoices" | "settings" | "voice";
const pageInfo: Record<PageKind, { title: string; description: string; icon: typeof Users }> = {
  customers: { title: "Customers", description: "Customer contacts, credit and balances.", icon: Users },
  transactions: { title: "Transactions", description: "Sales, purchases and returns in one ledger.", icon: FileText },
  reports: { title: "Reports", description: "Export compliant sales, inventory and GST reports.", icon: Download },
  analytics: { title: "Analytics", description: "Sales and revenue trends across your business.", icon: BarChart3 },
  invoices: { title: "Invoices", description: "Issued invoices and their payment status.", icon: FileText },
  settings: { title: "Settings", description: "Business profile and workspace preferences.", icon: Settings2 },
  voice: { title: "Voice recorder", description: "Record a transaction in English, Tamil, Hindi or mixed language.", icon: Mic },
};

export function AppPage({ kind }: { kind: PageKind }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const info = pageInfo[kind];
  const Icon = info.icon;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (kind === "voice" || kind === "settings") { if (active) setRows([]); return; }
        const url = kind === "analytics" ? "/dashboard/trends" : kind === "reports" ? "/reports/sales" : kind === "customers" ? "/customers" : "/transactions";
        const response = await api.get<{ data: Record<string, unknown>[] | { rows?: Record<string, unknown>[]; salesTrend?: Record<string, unknown>[] } }>(url);
        const data = response.data.data;
        const result = Array.isArray(data) ? data : data.rows ?? data.salesTrend ?? [];
        if (active) setRows(result);
      } catch { if (active) setError("We could not load this page. Check that the API is running and try again."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [kind]);

  const exportSales = () => { window.open(`${api.defaults.baseURL}/reports/sales/export?format=csv`, "_blank", "noopener,noreferrer"); };
  const remindCustomer = async (id: string) => { try { const response = await api.post<{ data: { whatsappLink: string | null } }>(`/customers/${id}/payment-reminder`); if (response.data.data.whatsappLink) window.open(response.data.data.whatsappLink, "_blank", "noopener,noreferrer"); else setError("This customer has no phone number. Add one before sending a WhatsApp reminder."); } catch (requestError) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.detail ?? "Unable to create payment reminder." : "Unable to create payment reminder."); } };
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-violet-700">KhataFlow</p><h1 className="mt-1 text-3xl font-bold">{info.title}</h1><p className="mt-2 text-slate-600">{info.description}</p></div>{kind === "reports" && <Button onClick={exportSales}><Download className="mr-2" size={16} />Export sales CSV</Button>}{kind === "voice" && <Button onClick={() => setVoiceOpen(true)}><Mic className="mr-2" size={16} />Start recording</Button>}</header>
    {kind === "settings" ? <SettingsPanel /> : <Card className="mt-8 overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-200 p-5"><Icon className="text-violet-600" size={20} /><p className="font-semibold">{kind === "reports" ? "Sales report" : `${info.title} data`}</p></div>{loading ? <div className="flex justify-center p-14 text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} />Loading…</div> : error ? <div role="alert" className="m-5 flex gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</div> : rows.length === 0 ? <div className="p-14 text-center"><Package className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-semibold">Nothing to show yet</p><p className="mt-1 text-sm text-slate-500">New business activity will appear here automatically.</p></div> : <DataTable rows={rows} onReminder={kind === "customers" ? remindCustomer : undefined} />}</Card>}
  </div><VoiceRecordingModal open={voiceOpen} onOpenChange={setVoiceOpen} /></main>;
}

function DataTable({ rows, onReminder }: { rows: Record<string, unknown>[]; onReminder?: (id: string) => void }) {
  const columns = Object.keys(rows[0] ?? {});
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}{onReminder && <th className="px-5 py-3 font-medium">Action</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-slate-100">{columns.map((column) => <td key={column} className="px-5 py-3">{String(row[column] ?? "—")}</td>)}{onReminder && <td className="px-5 py-3"><Button variant="outline" className="h-8" disabled={Number(row.outstandingBalance ?? 0) <= 0} onClick={() => onReminder(String(row.id))}>Send reminder</Button></td>}</tr>)}</tbody></table></div>;
}

function SettingsPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState("system");
  useEffect(() => { void api.get<{ data: { theme?: string } }>("/settings").then((response) => setTheme(response.data.data.theme ?? "system")).catch(() => setMessage("Settings will be available when the API is connected.")); }, []);
  const save = async () => { try { await api.patch("/settings", { theme }); document.documentElement.dataset.theme = theme; setMessage("Settings saved."); } catch { setMessage("Could not save settings."); } };
  return <Card className="mt-8 max-w-xl p-6"><label className="block text-sm font-medium">Theme<select className="mt-2 block h-10 w-full rounded-md border border-slate-300 bg-white px-3" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><Button className="mt-5" onClick={() => void save()}>Save preferences</Button>{message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}</Card>;
}
