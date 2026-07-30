import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";

interface DailyClose {
  date: string;
  salesCount: number;
  revenue: string;
  taxCollected: string;
  amountCollected: string;
  pendingDues: string;
  customerPaymentsCount: number;
  paymentSplit: Record<string, string>;
  lowStockCount: number;
  outstandingCredit: string;
  invoices: Array<{ invoiceNumber: string; total: string; paid: string; paymentMode: string; paymentStatus: string }>;
}

function money(value: string | number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));
}

export function DailyClosePage() {
  const [data, setData] = useState<DailyClose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .get<{ data: DailyClose }>("/daily-close")
      .then((res) => setData(res.data.data))
      .catch(() => setError("Could not load daily close."))
      .finally(() => setLoading(false));
  }, []);

  const exportFile = async (format: "csv" | "pdf") => {
    const res = await api.get(`/daily-close/export`, { params: { format }, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `khataflow-daily-close.${format === "pdf" ? "pdf" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">End of day</p>
          <h1 className="page-title">Daily close</h1>
          <p className="page-subtitle">Reconcile cash, UPI, card, credit, and pending dues.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void exportFile("csv")}>
            <Download size={16} className="mr-2" /> CSV
          </Button>
          <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]" onClick={() => void exportFile("pdf")}>
            <Download size={16} className="mr-2" /> PDF
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading || !data ? (
        <Card className="surface-panel h-40 animate-pulse" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Date", data.date],
              ["Sales", String(data.salesCount)],
              ["Revenue", money(data.revenue)],
              ["Collected", money(data.amountCollected)],
              ["GST", money(data.taxCollected)],
              ["Pending dues", money(data.pendingDues)],
              ["Outstanding credit", money(data.outstandingCredit)],
              ["Low stock", String(data.lowStockCount)],
            ].map(([label, value]) => (
              <Card key={label} className="surface-panel p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
                <p className="mt-2 font-display text-2xl">{value}</p>
              </Card>
            ))}
          </div>

          <Card className="surface-panel mt-6 p-5">
            <h2 className="font-display text-xl">Payment split</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {Object.entries(data.paymentSplit).map(([mode, amount]) => (
                <div key={mode} className="rounded-lg border border-[var(--line)] p-3">
                  <p className="text-xs uppercase text-[var(--muted)]">{mode}</p>
                  <p className="mt-1 font-semibold">{money(amount)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="surface-panel mt-6 overflow-hidden">
            <div className="border-b border-[var(--line)] p-4 font-display text-xl">Today&apos;s invoices</div>
            <div className="divide-y divide-[var(--line)]">
              {data.invoices.map((invoice) => (
                <div key={invoice.invoiceNumber} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber || "Untitled"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {invoice.paymentMode} · {invoice.paymentStatus}
                    </p>
                  </div>
                  <p className="font-semibold">{money(invoice.total)}</p>
                </div>
              ))}
              {!data.invoices.length && <p className="p-4 text-sm text-[var(--muted)]">No sales recorded today.</p>}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
