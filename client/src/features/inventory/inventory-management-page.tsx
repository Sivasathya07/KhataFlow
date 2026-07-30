import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ArrowDownToLine, ArrowUpFromLine, ClipboardList,
  LoaderCircle, PackageSearch, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listProducts } from "./api";
import type { ProductSummary } from "./types";

type Summary = { productCount: number; lowStockCount: number; inventoryValue: string };
type LowStock = { id: string; name: string; quantityOnHand: string; reorderLevel: string; unit: string };

function formatCurrency(value: string | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value ?? 0));
}

export function InventoryManagementPage() {
  const [summary, setSummary] = useState<Summary>();
  const [alerts, setAlerts] = useState<LowStock[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [movement, setMovement] = useState<"stock_in" | "stock_out">("stock_in");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryRes, lowRes, productRes] = await Promise.all([
        api.get<{ data: Summary }>("/inventory/summary"),
        api.get<{ data: LowStock[] }>("/inventory/low-stock"),
        listProducts(),
      ]);
      setSummary(summaryRes.data.data);
      setAlerts(lowRes.data.data);
      setProducts(productRes);
    } catch {
      setMessage({ text: "Inventory data could not be loaded. Check the API connection.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveMovement = async () => {
    if (!productId || Number(quantity) <= 0) {
      setMessage({ text: "Choose a product and enter a quantity greater than zero.", type: "error" });
      return;
    }
    try {
      await api.post("/inventory/movements", { productId, quantity, movementType: movement });
      setMessage({ text: "Stock updated successfully.", type: "success" });
      setQuantity("");
      void load();
    } catch {
      setMessage({ text: "Stock could not be updated. Check available stock and try again.", type: "error" });
    }
  };

  const selectClass = "h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]";

  return (
    <main className="page-shell">
      <div className="mb-6">
        <p className="eyebrow">Stock control</p>
        <h1 className="page-title">Inventory</h1>
        <p className="page-subtitle">Receive stock, issue stock, and monitor reorder risks. Product catalogue lives in Products.</p>
      </div>

      {message && (
        <div className={`mb-5 rounded-xl border p-3.5 text-sm ${
          message.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`} role="status">
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-[var(--muted)]">
          <LoaderCircle className="mr-2 animate-spin" size={20} /> Loading inventory…
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="mb-7 grid gap-4 sm:grid-cols-3">
            {[
              { icon: PackageSearch, label: "Tracked products", value: String(summary?.productCount ?? 0), tone: "accent" },
              { icon: ClipboardList, label: "Low-stock items", value: String(summary?.lowStockCount ?? 0), tone: "amber" },
              { icon: ArrowUpFromLine, label: "Inventory value", value: formatCurrency(summary?.inventoryValue), tone: "emerald" },
            ].map(({ icon: Icon, label, value, tone }) => (
              <Card key={label} className="surface-panel p-5">
                <Icon className={tone === "accent" ? "text-[var(--accent)]" : tone === "amber" ? "text-amber-500" : "text-emerald-600"} size={20} />
                <p className="mt-4 font-display text-2xl text-[var(--ink)]">{value}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Movement form */}
            <Card className="surface-panel p-5">
              <h2 className="font-semibold text-[var(--ink)]">Record stock movement</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Creates an auditable inventory log entry.</p>

              <select
                aria-label="Product"
                className={`mt-5 ${selectClass}`}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.quantityOnHand} {p.unit}
                  </option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <select
                  aria-label="Movement type"
                  className={selectClass}
                  value={movement}
                  onChange={(e) => setMovement(e.target.value as "stock_in" | "stock_out")}
                >
                  <option value="stock_in">Stock in</option>
                  <option value="stock_out">Stock out</option>
                </select>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantity"
                />
              </div>

              <Button
                className="mt-4 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                onClick={() => void saveMovement()}
              >
                {movement === "stock_in"
                  ? <><ArrowDownToLine className="mr-2" size={16} /> Stock in</>
                  : <><ArrowUpFromLine className="mr-2" size={16} /> Stock out</>
                }
              </Button>
            </Card>

            {/* Low-stock alerts */}
            <Card className="surface-panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--line)] p-5">
                <AlertTriangle className="text-amber-500" size={18} />
                <h2 className="font-semibold text-[var(--ink)]">Low-stock alerts</h2>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {alerts.length ? (
                  alerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 text-sm">
                      <span className="font-medium text-[var(--ink)]">{a.name}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        {a.quantityOnHand} / reorder {a.reorderLevel} {a.unit}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-[var(--muted)]">
                    All products are above reorder levels. 
                  </p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
