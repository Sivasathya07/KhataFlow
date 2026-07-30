import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Trash2, Plus, Minus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string | null;
  sellingPrice: number | string;
  taxRate?: number | string;
  quantityOnHand?: number | string;
}

interface Customer {
  id: string;
  name: string;
}

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

function money(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

export function PosPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    searchRef.current?.focus();
    void api.get<{ data: Product[] }>("/inventory/products", { params: { limit: 100 } }).then((res) => setProducts(res.data.data));
    void api.get<{ data: Customer[] }>("/customers", { params: { limit: 100 } }).then((res) => setCustomers(res.data.data));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, query]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of cart) {
      const lineSub = line.quantity * line.unitPrice;
      subtotal += lineSub;
      tax += (lineSub * line.gstRate) / 100;
    }
    return { subtotal, tax, grand: subtotal + tax };
  }, [cart]);

  const addProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: Number(product.sellingPrice),
          gstRate: Number(product.taxRate ?? 0),
        },
      ];
    });
    setQuery("");
    searchRef.current?.focus();
  };

  const checkout = async () => {
    if (!cart.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const paid = paymentMode === "credit" ? 0 : Number(amountPaid || totals.grand);
      const res = await api.post<{ data: { invoiceNumber?: string } }>("/transactions", {
        transactionType: "sale",
        customerId: customerId || null,
        paymentMode,
        amountPaid: paid,
        lineItems: cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstRate: line.gstRate,
          discount: 0,
        })),
      });
      setMessage(`Sale recorded${res.data.data.invoiceNumber ? `: ${res.data.data.invoiceNumber}` : ""}.`);
      setCart([]);
      setAmountPaid("");
      setPaymentMode("cash");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not complete sale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Counter</p>
          <h1 className="page-title">Quick Sale</h1>
          <p className="page-subtitle">Scan or search, build the cart, collect payment.</p>
        </div>
        <Button onClick={() => searchRef.current?.focus()} variant="outline">
          Focus search
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="surface-panel p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <Input
              ref={searchRef}
              className="h-12 pl-10 text-base"
              placeholder="Search name, SKU, or barcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  addProduct(matches[0]);
                }
              }}
            />
          </div>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {matches.map((product) => (
              <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[var(--paper-strong)]">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {product.sku || "No SKU"} · stock {String(product.quantityOnHand ?? "—")}
                  </p>
                </div>
                <p className="font-semibold text-[var(--accent-strong)]">{money(Number(product.sellingPrice))}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="surface-panel p-5">
          <h2 className="font-display text-xl">Cart</h2>
          <div className="mt-4 space-y-3">
            {cart.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.product.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {money(line.unitPrice)} · GST {line.gstRate}%
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded border border-[var(--line)] p-1" onClick={() => setCart((prev) => prev.map((l) => (l.product.id === line.product.id ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l)))}>
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                  <button type="button" className="rounded border border-[var(--line)] p-1" onClick={() => setCart((prev) => prev.map((l) => (l.product.id === line.product.id ? { ...l, quantity: l.quantity + 1 } : l)))}>
                    <Plus size={14} />
                  </button>
                  <button type="button" className="ml-1 rounded p-1 text-rose-600" onClick={() => setCart((prev) => prev.filter((l) => l.product.id !== line.product.id))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!cart.length && <p className="text-sm text-[var(--muted)]">Cart is empty. Add products from search.</p>}
          </div>

          <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>GST</span><span>{money(totals.tax)}</span></div>
            <div className="flex justify-between font-display text-lg"><span>Total</span><span>{money(totals.grand)}</span></div>
          </div>

          <div className="mt-4 space-y-3">
            <select className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-4 gap-2">
              {(["cash", "upi", "card", "credit"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setPaymentMode(mode)} className={`rounded-md border px-2 py-2 text-xs font-semibold uppercase ${paymentMode === mode ? "border-[var(--accent)] bg-teal-50 text-[var(--accent-strong)]" : "border-[var(--line)]"}`}>
                  {mode}
                </button>
              ))}
            </div>
            {paymentMode !== "credit" && (
              <Input type="number" min={0} step="0.01" placeholder={`Amount paid (default ${totals.grand.toFixed(2)})`} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            )}
            {error && <p className="text-sm text-rose-700">{error}</p>}
            {message && <p className="text-sm text-teal-800">{message}</p>}
            <Button disabled={!cart.length || saving} onClick={() => void checkout()} className="h-11 w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
              {saving ? "Saving…" : "Complete sale"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
