import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Printer,
  Trash2,
  AlertCircle,
  LoaderCircle,
  ReceiptText,
} from "lucide-react";
import { listProducts } from "@/features/inventory/api";
import type { ProductSummary } from "@/features/inventory/types";

interface Transaction {
  id: string;
  invoiceNumber: string;
  transactionType: "sale" | "purchase" | "return";
  paymentStatus: "paid" | "partial" | "pending";
  grandTotal: string;
  createdAt: string;
}

interface Customer { id: string; name: string; outstandingBalance: number; }
interface LineItemState {
  productId: string; productName: string;
  quantity: number; unitPrice: number; discount: number; gstRate: number;
}

function money(v: string | number) {
  return "₹" + Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactionType, setTransactionType] = useState<"sale" | "purchase" | "return">("sale");
  const [customerId, setCustomerId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: Transaction[]; pagination: { total: number; limit: number } }>(
        "/transactions", { params: { page, limit: 15 } }
      );
      setTransactions(res.data.data);
      setTotalPages(Math.ceil(res.data.pagination.total / res.data.pagination.limit) || 1);
    } catch { setError("Failed to load transactions."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchTransactions(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!createOpen) return;
    void Promise.all([
      listProducts(),
      api.get<{ data: Customer[] }>("/customers", { params: { limit: 100 } }),
    ]).then(([prods, custs]) => { setProducts(prods); setCustomers(custs.data.data); }).catch(() => {});
    setLineItems([{ productId: "", productName: "", quantity: 1, unitPrice: 0, discount: 0, gstRate: 0 }]);
    setCustomerId(""); setPaymentMode("cash"); setAmountPaid("0"); setNotes(""); setFormError(null);
  }, [createOpen]);

  const totals = lineItems.reduce(
    (acc, item) => {
      const sub = item.quantity * item.unitPrice;
      const tax = ((sub - item.discount) * item.gstRate) / 100;
      return { subtotal: acc.subtotal + sub, discount: acc.discount + item.discount, tax: acc.tax + tax };
    },
    { subtotal: 0, discount: 0, tax: 0 }
  );
  const grandTotal = totals.subtotal - totals.discount + totals.tax;

  useEffect(() => {
    setAmountPaid(paymentMode === "credit" ? "0" : grandTotal.toFixed(2));
  }, [paymentMode, grandTotal]);

  const updateLine = (i: number, key: keyof LineItemState, val: string | number) => {
    setLineItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        const next = { ...item, [key]: val };
        if (key === "productId") {
          const p = products.find((p) => p.id === val);
          if (p) { next.productName = p.name; next.unitPrice = parseFloat(p.sellingPrice); next.gstRate = 18; }
        }
        return next;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.some((item) => !item.productId)) { setFormError("Select a product for all line items."); return; }
    setSaving(true); setFormError(null);
    try {
      await api.post("/transactions", {
        transactionType, customerId: customerId || null, paymentMode,
        amountPaid: parseFloat(amountPaid) || 0, notes: notes || null,
        lineItems: lineItems.map(({ productId, quantity, unitPrice, discount, gstRate }) => ({
          productId, quantity, unitPrice, discount, gstRate,
        })),
      });
      setCreateOpen(false);
      void fetchTransactions();
    } catch (err: unknown) {
      const r = (err as { response?: { data?: { detail?: string; error?: { message?: string } } } })?.response?.data;
      setFormError(r?.error?.message ?? (typeof r?.detail === "string" ? r.detail : "Failed to create transaction."));
    } finally { setSaving(false); }
  };

  const handlePrint = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt ${tx.invoiceNumber}</title>
    <style>
      body{font-family:monospace;padding:24px;max-width:320px;margin:auto;color:#111}
      .c{text-align:center}.big{font-size:20px;font-weight:700}.sm{font-size:12px}
      hr{border:none;border-top:1px dashed #bbb;margin:12px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .total{font-weight:700;font-size:16px}
    </style></head><body>
    <div class="c big">KhataFlow</div>
    <div class="c sm">${tx.invoiceNumber} &bull; ${new Date(tx.createdAt).toLocaleDateString("en-IN")}</div>
    <hr/>
    <div class="row"><span>Type</span><span>${tx.transactionType.toUpperCase()}</span></div>
    <div class="row"><span>Status</span><span>${tx.paymentStatus.toUpperCase()}</span></div>
    <hr/>
    <div class="row total"><span>Grand Total</span><span>${money(tx.grandTotal)}</span></div>
    <hr/>
    <div class="c sm" style="margin-top:16px">Thank you for your business!</div>
    <script>window.print();window.close();</script></body></html>`);
    w.document.close();
  };

  const typeColors: Record<string, string> = {
    sale: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    purchase: "bg-sky-50 text-sky-700 border border-sky-200",
    return: "bg-rose-50 text-rose-700 border border-rose-200",
  };
  const statusColors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    pending: "bg-red-100 text-red-800",
  };

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><ReceiptText size={12} /> Ledger</p>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">All sales, purchases, and returns with GST invoicing.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
          <Plus className="mr-2" size={17} /> New Transaction
        </Button>
      </div>

      <div className="surface-panel overflow-hidden">
        {error && (
          <div className="m-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} /><span>{error}</span>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16 text-[var(--muted)]">
            <LoaderCircle className="mr-2 animate-spin" size={18} /> Loading ledger…
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto text-[var(--line)]" size={36} />
            <p className="mt-3 font-semibold text-[var(--ink)]">No transactions yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Create a transaction or use the POS or voice recorder.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--paper-strong)] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">Invoice</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">Total</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--panel-hover)] transition">
                    <td className="px-5 py-3.5 font-semibold text-[var(--ink)]">{tx.invoiceNumber}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColors[tx.transactionType] ?? ""}`}>
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[tx.paymentStatus] ?? ""}`}>
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)] text-xs">
                      {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                      {" "}
                      {new Date(tx.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[var(--ink)]">{money(tx.grandTotal)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => handlePrint(tx)} className="h-8">
                        <Printer size={13} className="mr-1.5" /> Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] p-4">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8">Previous</Button>
            <span className="text-xs text-[var(--muted)]">Page {page} of {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8">Next</Button>
          </div>
        )}
      </div>

      {/* Create Transaction Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-[var(--panel)] text-[var(--ink)]">
          <DialogTitle className="font-display text-xl border-b border-[var(--line)] pb-3">New Transaction</DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4 mt-3">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={15} /><span>{formError}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {(["Type", "Customer", "Payment"] as const).map((lbl, i) => (
                <div key={lbl} className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">{lbl}</label>
                  {i === 0 && (
                    <select className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]"
                      value={transactionType} onChange={(e) => setTransactionType(e.target.value as typeof transactionType)}>
                      <option value="sale">Sale</option>
                      <option value="purchase">Purchase</option>
                      <option value="return">Return</option>
                    </select>
                  )}
                  {i === 1 && (
                    <select className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]"
                      value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Walk-in customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} (Due: {money(c.outstandingBalance)})</option>
                      ))}
                    </select>
                  )}
                  {i === 2 && (
                    <select className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]"
                      value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="credit">Credit</option>
                    </select>
                  )}
                </div>
              ))}
            </div>

            {/* Line items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Line Items</span>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => setLineItems((prev) => [...prev, { productId: "", productName: "", quantity: 1, unitPrice: 0, discount: 0, gstRate: 18 }])}>
                  + Add row
                </Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, i) => (
                  <div key={i} className="grid gap-2 items-end rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] p-3
                    sm:grid-cols-[1.6fr_70px_90px_70px_60px_auto]">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--muted)] mb-1">Product</label>
                      <select className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-xs text-[var(--ink)]"
                        value={item.productId} onChange={(e) => updateLine(i, "productId", e.target.value)}>
                        <option value="">Select…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {([["Qty", "quantity", 0.01], ["Price", "unitPrice", 0.01], ["Disc", "discount", 0], ["GST%", "gstRate", 0]] as const).map(([lbl, field, min]) => (
                      <div key={field}>
                        <label className="block text-[10px] font-semibold uppercase text-[var(--muted)] mb-1">{lbl}</label>
                        <Input type="number" min={min} step="any"
                          className="h-9 text-xs bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                          value={item[field as keyof LineItemState]}
                          onChange={(e) => updateLine(i, field as keyof LineItemState, parseFloat(e.target.value) || 0)} />
                      </div>
                    ))}
                    <Button type="button" variant="ghost" disabled={lineItems.length === 1}
                      onClick={() => setLineItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="h-9 w-9 p-0 text-rose-500 hover:text-rose-700">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 border-t border-[var(--line)] pt-4">
              <div>
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">Notes</label>
                <textarea className="mt-1 w-full h-24 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)]"
                  placeholder="Memo, serial numbers…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] p-4 space-y-2 text-sm">
                {[["Subtotal", money(totals.subtotal)], ["Discount", `-${money(totals.discount)}`], ["GST", money(totals.tax)],
                  ["Grand Total", money(grandTotal)]
                ].map(([lbl, val], i) => (
                  <div key={lbl} className={`flex justify-between ${i === 3 ? "border-t border-[var(--line)] pt-2 font-bold text-[var(--ink)] text-base" : "text-[var(--muted)]"}`}>
                    <span>{lbl}</span><span>{val}</span>
                  </div>
                ))}
                <div className="mt-2">
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">Amount Paid</label>
                  <Input type="number" disabled={paymentMode === "credit"}
                    className="mt-1 h-10 bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                    value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
                {saving ? "Processing…" : "Complete Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
