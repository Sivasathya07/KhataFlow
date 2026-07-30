import { Bell, ChevronRight, CircleDollarSign, FileText, Lightbulb, MessageCircleMore, Mic, PackagePlus, ShoppingCart, Sparkles, UserPlus, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AiActionCard } from "./ai-action-card";
import { MetricCard } from "./metric-card";
import { VoiceRecordingModal } from "@/features/voice/voice-recording-modal";

const insightTones: Record<string, string> = {
  teal:   "bg-teal-50 text-teal-800 ring-1 ring-teal-200",
  amber:  "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  sky:    "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  violet: "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]",
};

export function DashboardPage() {
  const { user } = useAuth();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshotMetrics, setSnapshotMetrics] = useState<Array<{ label: string; value: string; change: string; tone: "emerald" | "violet" | "sky" | "amber" }>>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<Array<{ product: string; stock: string; status: string; tone: "red" | "amber" | "sky" }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<Array<{ name: string; type: string; time: string; amount: string; tone: "emerald" | "slate" }>>([]);
  const [insights, setInsights] = useState<Array<{ title: string; description: string; action: string; route: string; confidence: number; tone: string }>>([]);
  const navigate = (route: string) => {
    window.location.hash = route;
  };
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [dash, insightRes] = await Promise.all([
          api.get<{
            data: {
              metrics: Record<string, string | number>;
              lowStock: Array<{ name: string; quantityOnHand: string }>;
              recentTransactions: Array<{ invoiceNumber: string; paymentStatus: string; grandTotal: string; createdAt: string }>;
            };
          }>("/dashboard"),
          api.get<{ data: { insights: Array<{ title: string; description: string; action: string; route: string; confidence: number; tone: string }> } }>("/dashboard/insights"),
        ]);
        if (!active) return;
        const metrics = dash.data.data.metrics;
        setSnapshotMetrics([
          { label: "Today's sales", value: formatCurrency(metrics.todaySales), change: `Week: ${formatCurrency(metrics.weeklySales)}`, tone: "emerald" },
          { label: "Profit", value: formatCurrency(metrics.profit), change: `Revenue: ${formatCurrency(metrics.revenue)}`, tone: "violet" },
          { label: "Inventory value", value: formatCurrency(metrics.inventoryValue), change: `${metrics.lowStockCount} low-stock items`, tone: "sky" },
          { label: "Outstanding credit", value: formatCurrency(metrics.outstandingCredit), change: `Pending: ${formatCurrency(metrics.pendingPayments)}`, tone: "amber" },
        ]);
        setInventoryAlerts(dash.data.data.lowStock.map((item) => ({ product: item.name, stock: `${item.quantityOnHand} remaining`, status: "Low stock", tone: "amber" })));
        setRecentTransactions(
          dash.data.data.recentTransactions.map((item) => ({
            name: item.invoiceNumber,
            type: item.paymentStatus,
            time: new Date(item.createdAt).toLocaleString(),
            amount: formatCurrency(item.grandTotal),
            tone: "emerald",
          })),
        );
        setInsights(insightRes.data.data.insights);
      } catch {
        if (active) setLoadError("Live business data could not be loaded. Check that the API and MongoDB are running.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--ink)] px-6 py-8 text-[var(--paper)] shadow-xl sm:px-9 sm:py-10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-28 w-72 rounded-full bg-amber-200/10 blur-3xl" />
        <div className="relative max-w-2xl animate-rise">
          <p className="font-display text-4xl tracking-tight sm:text-5xl">KhataFlow</p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-200/90">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {greeting}, {user?.displayName?.split(" ")[0] || "there"}.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            Sales, stock, credit, and daily close — ready when the counter is.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-[var(--accent)] text-white hover:bg-teal-600" onClick={() => navigate("pos")}>
              <ShoppingCart className="mr-2" size={16} /> Quick sale
            </Button>
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => setVoiceOpen(true)}>
              <Mic className="mr-2" size={16} /> Voice sale
            </Button>
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => navigate("assistant")}>
              Ask AI <ChevronRight className="ml-1" size={16} />
            </Button>
          </div>
        </div>
      </section>

      <section id="business-snapshot" className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Business snapshot</p>
            <p className="page-subtitle">A clear view of today&apos;s work.</p>
          </div>
          <Button variant="ghost" className="hidden text-[var(--accent-strong)] sm:inline-flex" onClick={() => navigate("reports")}>
            View reports <ChevronRight className="ml-1" size={16} />
          </Button>
        </div>
        {loadError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, index) => <Card key={index} className="h-36 animate-pulse bg-[var(--paper-strong)]" />)
            : snapshotMetrics.map((metric, index) => <MetricCard key={metric.label} metric={metric} index={index} />)}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="eyebrow flex items-center gap-2"><Sparkles size={14} /> Work faster</p>
          <h2 className="font-display text-2xl tracking-tight">Tell me what happened.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <AiActionCard title="Speak a transaction" description="Say it naturally. Review before stock changes." icon={Mic} tone="violet" onClick={() => setVoiceOpen(true)} />
          <AiActionCard title="Quick Sale POS" description="Barcode-ready counter billing with GST." icon={ShoppingCart} tone="sky" onClick={() => navigate("pos")} />
          <AiActionCard title="Ask AI" description="Low stock, debtors, and sales answers." icon={MessageCircleMore} tone="amber" onClick={() => navigate("assistant")} />
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow flex items-center gap-2"><Lightbulb size={14} /> Live insights</p>
              <h2 className="font-display text-2xl tracking-tight">Here&apos;s what I noticed</h2>
            </div>
          </div>
          <Card className="surface-panel divide-y divide-[var(--line)] overflow-hidden">
            {insights.map((insight, index) => (
              <article key={insight.title} className="flex gap-4 p-5">
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-sm font-bold text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{insight.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${insightTones[insight.tone] ?? insightTones.teal}`}>{insight.confidence}% confident</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{insight.description}</p>
                  <button type="button" onClick={() => navigate(insight.route)} className="mt-3 inline-flex items-center text-sm font-semibold text-[var(--accent-strong)]">
                    {insight.action}
                    <ChevronRight className="ml-0.5" size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!insights.length && !loading && <p className="p-5 text-sm text-[var(--muted)]">Insights will appear as your shop data grows.</p>}
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="surface-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
              <div>
                <p className="text-sm font-semibold">Inventory alerts</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Keep sales moving.</p>
              </div>
              <PackagePlus className="text-amber-600" size={21} />
            </div>
            <div className="divide-y divide-[var(--line)]">
              {inventoryAlerts.map((alert) => (
                <button type="button" onClick={() => navigate("inventory")} key={alert.product} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/50">
                  <div>
                    <p className="text-sm font-medium">{alert.product}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{alert.stock}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{alert.status}</span>
                </button>
              ))}
              {!inventoryAlerts.length && <p className="p-4 text-sm text-[var(--muted)]">No low-stock alerts.</p>}
            </div>
          </Card>
          <Card className="overflow-hidden bg-[var(--accent)] p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-100">Daily close</p>
                <h3 className="mt-1 font-display text-xl">Wrap up the counter.</h3>
              </div>
              <CircleDollarSign className="text-teal-100" size={24} />
            </div>
            <p className="mt-3 text-sm leading-6 text-teal-50">Reconcile cash, UPI, card, credit and export the day.</p>
            <Button className="mt-5 bg-white text-[var(--accent-strong)] hover:bg-teal-50" onClick={() => navigate("daily-close")}>
              Start daily close
            </Button>
          </Card>
        </section>
      </div>

      <section className="mt-10 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h2 className="font-display text-2xl tracking-tight">Your business, in motion</h2>
          </div>
          <Button variant="ghost" className="text-[var(--accent-strong)]" onClick={() => navigate("transactions")}>
            Transaction history <ChevronRight className="ml-1" size={16} />
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="surface-panel overflow-hidden">
            <div className="divide-y divide-[var(--line)]">
              {recentTransactions.map((transaction) => (
                <button type="button" onClick={() => navigate("transactions")} key={`${transaction.name}-${transaction.time}`} className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/50 sm:p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--paper-strong)] text-[var(--muted)]">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{transaction.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {transaction.type} · {transaction.time}
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-700">{transaction.amount}</p>
                </button>
              ))}
              {!recentTransactions.length && <p className="p-5 text-sm text-[var(--muted)]">No recent transactions.</p>}
            </div>
          </Card>
          <Card className="surface-panel p-5">
            <p className="text-sm font-semibold">Quick actions</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <QuickAction icon={UserPlus} label="Add customer" onClick={() => navigate("customers")} />
              <QuickAction icon={PackagePlus} label="Add product" onClick={() => navigate("products")} />
              <QuickAction icon={ShoppingCart} label="New sale" onClick={() => navigate("pos")} />
              <QuickAction icon={Bell} label="Notifications" onClick={() => window.dispatchEvent(new CustomEvent("khataflow:open-notifications"))} />
            </div>
          </Card>
        </div>
      </section>
      <VoiceRecordingModal open={voiceOpen} onOpenChange={setVoiceOpen} />
    </main>
  );
}

function formatCurrency(value: string | number | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-xl border border-[var(--line)] p-3 text-left transition hover:border-teal-300 hover:bg-teal-50/60">
      <Icon className="text-[var(--accent)]" size={18} />
      <span className="mt-4 block text-sm font-semibold group-hover:text-[var(--accent-strong)]">{label}</span>
    </button>
  );
}
