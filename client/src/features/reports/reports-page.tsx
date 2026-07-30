import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Download, Calendar, AlertCircle, LoaderCircle,
  DollarSign, Briefcase, Layers, FileText,
} from "lucide-react";

type ReportType = "sales" | "inventory" | "customers" | "gst" | "profit";

interface ReportRow { [key: string]: string | number | null | undefined; }

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("sales");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<{ records: number; total: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: { rows: ReportRow[]; summary: { records: number; total: string } } }>(
        `/reports/${activeTab}`, { params: { startDate, endDate } }
      );
      setRows(res.data.data.rows);
      setSummary(res.data.data.summary);
    } catch { setError("Unable to compile report. Check date range and API status."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchReport(); }, [activeTab, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = (format: "csv" | "excel" | "pdf") => {
    void (async () => {
      try {
        const res = await api.get(`/reports/${activeTab}/export`, {
          params: { format, startDate, endDate }, responseType: "blob",
        });
        const mime = format === "pdf" ? "application/pdf"
          : format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv";
        const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `khataflow-${activeTab}.${format === "excel" ? "xlsx" : format}`;
        a.click(); a.remove(); URL.revokeObjectURL(url);
      } catch { alert("Export failed."); }
    })();
  };

  const tabs: { id: ReportType; label: string }[] = [
    { id: "sales", label: "Sales" },
    { id: "inventory", label: "Inventory" },
    { id: "customers", label: "Customers" },
    { id: "gst", label: "GST" },
    { id: "profit", label: "Profit" },
  ];

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><FileText size={12} /> Reports</p>
          <h1 className="page-title">Business Reports</h1>
          <p className="page-subtitle">GST-compliant exports: CSV, Excel, and PDF statements.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["csv", "excel", "pdf"] as const).map((fmt) => (
            <Button key={fmt} variant="outline" onClick={() => handleExport(fmt)} className="h-9 text-xs uppercase">
              <Download size={13} className="mr-1.5" /> {fmt}
            </Button>
          ))}
        </div>
      </div>

      {/* Tab + Date bar */}
      <Card className="surface-panel mb-6 p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--ink)]"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="text-[var(--muted)] shrink-0" size={16} />
          <Input type="date" className="h-9 w-36 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span className="text-[var(--muted)] text-sm">to</span>
          <Input type="date" className="h-9 w-36 text-xs" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card className="surface-panel p-5 flex items-center justify-between">
            <div>
              <p className="eyebrow">Total Entries</p>
              <p className="mt-2 font-display text-3xl text-[var(--ink)]">{summary.records}</p>
            </div>
            <span className="p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Briefcase size={20} /></span>
          </Card>
          <Card className="surface-panel p-5 flex items-center justify-between">
            <div>
              <p className="eyebrow">Total Value</p>
              <p className="mt-2 font-display text-3xl text-emerald-600">
                ₹{parseFloat(summary.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><DollarSign size={20} /></span>
          </Card>
        </div>
      )}

      {/* Table */}
      <div className="surface-panel overflow-hidden">
        {error && (
          <div className="m-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} /><span>{error}</span>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16 text-[var(--muted)]">
            <LoaderCircle className="animate-spin mr-2" size={18} /> Compiling report…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="mx-auto text-[var(--line)] mb-3" size={32} />
            <p className="font-semibold text-[var(--ink)]">No records for this period</p>
            <p className="text-xs text-[var(--muted)] mt-1">Adjust the date range or record more activity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--paper-strong)] text-[var(--muted)]">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                      {col.replace(/([A-Z])/g, " $1").trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--panel-hover)] transition">
                    {columns.map((col) => (
                      <td key={col} className="px-5 py-3 text-[var(--ink)]">
                        {typeof row[col] === "boolean" ? (row[col] ? "Yes" : "No") : String(row[col] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
