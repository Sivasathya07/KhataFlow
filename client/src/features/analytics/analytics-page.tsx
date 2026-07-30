import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  Package,
  Award,
  LoaderCircle,
  AlertCircle,
  ArrowUpRight,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrendDay {
  date: string;
  sales: string;
  revenue: string;
}

interface ProductRevenue {
  name: string;
  quantity: string;
  revenue: string;
}

interface CustomerCredit {
  id: string;
  name: string;
  outstandingBalance: string;
}

function money(v: string | number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v ?? 0));
}

export function AnalyticsPage() {
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [topProducts, setTopProducts] = useState<ProductRevenue[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(15);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendRes, dashboardRes] = await Promise.all([
        api.get<{ data: { salesTrend: TrendDay[] } }>("/dashboard/trends", { params: { days } }),
        api.get<{ data: { topProducts: ProductRevenue[]; topCustomers: CustomerCredit[] } }>("/dashboard"),
      ]);
      setTrends(trendRes.data.data.salesTrend);
      setTopProducts(dashboardRes.data.data.topProducts ?? []);
      setTopCustomers(dashboardRes.data.data.topCustomers ?? []);
    } catch {
      setError("Failed to fetch analytics. Make sure the API and database are running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchAnalytics(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxRevenue = Math.max(...trends.map((t) => parseFloat(t.revenue) || 0), 1);
  const totalRevenue = trends.reduce((sum, t) => sum + (parseFloat(t.revenue) || 0), 0);
  const totalSales = trends.reduce((sum, t) => sum + (parseFloat(t.sales) || 0), 0);

  // SVG dimensions
  const W = 640, H = 200, PAD = 44;
  const pts = trends.map((t, i) => {
    const x = PAD + (i * (W - PAD * 2)) / Math.max(trends.length - 1, 1);
    const y = H - PAD - ((parseFloat(t.revenue) || 0) / maxRevenue) * (H - PAD * 2);
    return { x, y, ...t };
  });
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = pts.length > 0
    ? `M ${pts[0].x},${H - PAD} L ${polyline} L ${pts[pts.length - 1].x},${H - PAD} Z`
    : "";

  return (
    <main className="page-shell">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><BarChart2 size={12} /> Analytics</p>
          <h1 className="page-title">Business Intelligence</h1>
          <p className="page-subtitle">Sales trends, top performers, and credit exposure in one view.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
            {[7, 15, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 text-xs font-semibold transition ${
                  days === d
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-hover)]"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => void fetchAnalytics()} className="h-9 px-3">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="surface-panel p-5">
          <p className="eyebrow">Period Revenue</p>
          <p className="mt-2 font-display text-3xl text-[var(--ink)]">{money(totalRevenue)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Last {days} days</p>
        </Card>
        <Card className="surface-panel p-5">
          <p className="eyebrow">Total Transactions</p>
          <p className="mt-2 font-display text-3xl text-[var(--ink)]">{totalSales.toFixed(0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Across {trends.length} days</p>
        </Card>
        <Card className="surface-panel p-5">
          <p className="eyebrow">Avg Daily Revenue</p>
          <p className="mt-2 font-display text-3xl text-[var(--ink)]">{money(trends.length ? totalRevenue / trends.length : 0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Per trading day</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-[var(--muted)]">
          <LoaderCircle className="animate-spin mr-2" size={22} />
          <span>Compiling metrics…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Revenue Trend Chart */}
          <Card className="surface-panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="text-[var(--accent)]" size={18} />
                  Revenue Trend
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Daily revenue over last {days} days</p>
              </div>
              <span className="text-xs text-[var(--muted)]">Peak: {money(maxRevenue)}</span>
            </div>
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[400px]" style={{ height: 200 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = PAD + (1 - frac) * (H - PAD * 2);
                  return (
                    <g key={frac}>
                      <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="4 4" />
                      <text x={PAD - 6} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="9">
                        {frac > 0 ? `₹${((frac * maxRevenue) / 1000).toFixed(0)}k` : "0"}
                      </text>
                    </g>
                  );
                })}
                {/* Area fill */}
                {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}
                {/* Line */}
                {polyline && <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={polyline} />}
                {/* Data points */}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="var(--panel)" stroke="var(--accent)" strokeWidth="2.5" />
                    <title>{p.date.slice(5)}: {money(p.revenue)}</title>
                  </g>
                ))}
                {/* X labels — every 3rd day */}
                {pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1).map((p) => (
                  <text key={p.date} x={p.x} y={H - 6} textAnchor="middle" fill="var(--muted)" fontSize="9">
                    {p.date.slice(5)}
                  </text>
                ))}
              </svg>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <Card className="surface-panel overflow-hidden">
              <div className="border-b border-[var(--line)] p-5">
                <h2 className="font-semibold flex items-center gap-2">
                  <Package className="text-[var(--accent)]" size={18} />
                  Top Products by Revenue
                </h2>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {topProducts.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[var(--muted)]">No product sales logged yet.</p>
                ) : (
                  topProducts.slice(0, 6).map((p, i) => {
                    const maxRev = Math.max(...topProducts.map((x) => parseFloat(x.revenue) || 0), 1);
                    const pct = ((parseFloat(p.revenue) || 0) / maxRev) * 100;
                    return (
                      <div key={i} className="p-4">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="font-medium text-sm truncate max-w-[60%]">{p.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[var(--accent-strong)]">{money(p.revenue)}</span>
                            <ArrowUpRight size={13} className="text-[var(--muted)]" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--line)]">
                            <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[var(--muted)] whitespace-nowrap">{p.quantity} units</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Top Customers (Debtors) */}
            <Card className="surface-panel overflow-hidden">
              <div className="border-b border-[var(--line)] p-5">
                <h2 className="font-semibold flex items-center gap-2">
                  <Award className="text-amber-500" size={18} />
                  Highest Credit Accounts
                </h2>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {topCustomers.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[var(--muted)]">No outstanding customer credit.</p>
                ) : (
                  topCustomers.slice(0, 6).map((c, i) => {
                    const maxBal = Math.max(...topCustomers.map((x) => parseFloat(x.outstandingBalance) || 0), 1);
                    const pct = ((parseFloat(c.outstandingBalance) || 0) / maxBal) * 100;
                    return (
                      <div key={i} className="p-4">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="font-medium text-sm truncate max-w-[60%]">{c.name}</p>
                          <span className="text-sm font-bold text-amber-600">{money(c.outstandingBalance)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--line)]">
                          <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
