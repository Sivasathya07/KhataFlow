import { useEffect, useState } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Search, Plus, MessageSquare, QrCode,
  AlertCircle, LoaderCircle, DollarSign, TrendingUp,
} from "lucide-react";

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; creditLimit: number; outstandingBalance: number; createdAt: string;
}

function money(v: number) {
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [active, setActive] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("5000");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: Customer[]; pagination: { total: number; limit: number } }>(
        "/customers", { params: { query: search || undefined, page, limit: 10 } }
      );
      setCustomers(res.data.data);
      setTotalPages(Math.ceil(res.data.pagination.total / res.data.pagination.limit) || 1);
    } catch { setError("Failed to load customer list."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); void fetchCustomers(); }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchCustomers(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      await api.post("/customers", { name, phone: phone || null, email: email || null, address: address || null, creditLimit: parseFloat(creditLimit) || 0 });
      setCreateOpen(false); setName(""); setPhone(""); setEmail(""); setAddress(""); setCreditLimit("5000");
      void fetchCustomers();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(typeof d === "string" ? d : "Failed to create customer.");
    } finally { setSaving(false); }
  };

  const handleReminder = async (c: Customer) => {
    try {
      const res = await api.post<{
        data: { whatsappLink: string | null; autoSent: boolean; autoSentError: string | null; customer: string }
      }>(`/customers/${c.id}/payment-reminder`);
      const { autoSent, autoSentError, whatsappLink, customer } = res.data.data;
      if (autoSent) {
        alert(`✅ WhatsApp message sent automatically to ${customer}!`);
      } else if (whatsappLink) {
        window.open(whatsappLink, "_blank", "noopener,noreferrer");
      } else {
        alert(autoSentError ?? "This customer has no phone number. Add one before sending a WhatsApp reminder.");
      }
    } catch (err: unknown) {
      alert(extractErrorMessage(err, "Could not send reminder."));
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!active) return;
    setSaving(true); setFormError(null);
    try {
      await api.post(`/customers/${active.id}/payments`, { amount: Number(payAmount), paymentMode: payMode, notes: payNotes || null });
      setPayOpen(false); setPayAmount(""); setPayNotes(""); void fetchCustomers();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(typeof d === "string" ? d : "Could not record payment.");
    } finally { setSaving(false); }
  };

  const handleQr = async (c: Customer) => {
    setActive(c); setQrOpen(true); setQrCodeUrl(null);
    try {
      const res = await api.post<{ data: { qrCodeDataUrl: string } }>(`/customers/${c.id}/payment-reminder`);
      setQrCodeUrl(res.data.data.qrCodeDataUrl);
    } catch { setQrOpen(false); setError("Failed to generate QR."); }
  };

  const totalOutstanding = customers.reduce((s, c) => s + Number(c.outstandingBalance), 0);

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Users size={12} /> Customers</p>
          <h1 className="page-title">Customer Ledger</h1>
          <p className="page-subtitle">Credit limits, outstanding balances, and payment reminders.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
          <Plus className="mr-2" size={17} /> Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="surface-panel p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="eyebrow">Active Debtors</p>
              <p className="mt-2 font-display text-3xl">{customers.filter((c) => c.outstandingBalance > 0).length}</p>
            </div>
            <span className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Users size={20} /></span>
          </div>
        </Card>
        <Card className="surface-panel p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="eyebrow">Outstanding Balance</p>
              <p className="mt-2 font-display text-3xl text-amber-600">{money(totalOutstanding)}</p>
            </div>
            <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><DollarSign size={20} /></span>
          </div>
        </Card>
        <Card className="surface-panel p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="eyebrow">Avg Credit Limit</p>
              <p className="mt-2 font-display text-3xl">
                {money(customers.reduce((a, c) => a + c.creditLimit, 0) / (customers.length || 1))}
              </p>
            </div>
            <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp size={20} /></span>
          </div>
        </Card>
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" />
          </div>
          <p className="text-sm text-[var(--muted)]">{customers.length} records</p>
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} /><span>{error}</span>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16 text-[var(--muted)]"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading…</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto text-[var(--line)]" size={36} />
            <p className="mt-3 font-semibold text-[var(--ink)]">No customers found</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Add customers to track shop credit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--paper-strong)] text-[var(--muted)]">
                <tr>
                  {["Name", "Contact", "Outstanding", "Limit", "Actions"].map((h) => (
                    <th key={h} className={`px-5 py-3 font-semibold text-xs uppercase tracking-wide ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--panel-hover)] transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[var(--ink)]">{c.name}</p>
                      <p className="text-xs text-[var(--muted)]">{c.address || "—"}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[var(--ink)]">{c.phone || "—"}</p>
                      <p className="text-xs text-[var(--muted)]">{c.email || "—"}</p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      <span className={c.outstandingBalance > 0 ? "text-amber-600" : "text-[var(--muted)]"}>
                        {money(c.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">{money(c.creditLimit)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" disabled={c.outstandingBalance <= 0}
                          onClick={() => { setActive(c); setPayAmount(String(c.outstandingBalance)); setPayOpen(true); setFormError(null); }}
                          className="h-8 text-xs">
                          <DollarSign size={13} className="mr-1" /> Pay
                        </Button>
                        <Button variant="outline" size="sm" disabled={c.outstandingBalance <= 0}
                          onClick={() => void handleQr(c)} className="h-8 text-xs">
                          <QrCode size={13} className="mr-1" /> QR
                        </Button>
                        <Button variant="outline" size="sm" disabled={c.outstandingBalance <= 0 || !c.phone}
                          onClick={() => void handleReminder(c)}
                          className="h-8 text-xs text-[var(--accent-strong)] border-[var(--accent-soft)]">
                          <MessageSquare size={13} className="mr-1" /> Remind
                        </Button>
                      </div>
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

      {/* Add Customer */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-[var(--panel)] text-[var(--ink)]">
          <DialogTitle className="font-display text-xl">Add Customer</DialogTitle>
          <form onSubmit={handleCreate} className="space-y-4 mt-3">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {[["Customer Name *", name, setName, "text", "Full Name", true],
              ["Phone", phone, setPhone, "text", "e.g. 919876543210", false],
              ["Email", email, setEmail, "email", "customer@mail.com", false],
              ["Address", address, setAddress, "text", "Home address", false],
              ["Credit Limit (₹)", creditLimit, setCreditLimit, "number", "5000", false],
            ].map(([lbl, val, setter, type, ph, req]) => (
              <div key={String(lbl)} className="space-y-1">
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">{String(lbl)}</label>
                <Input type={String(type)} required={Boolean(req)} placeholder={String(ph)}
                  value={String(val)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
                {saving ? "Saving…" : "Save Customer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md bg-[var(--panel)] text-[var(--ink)]">
          <DialogTitle className="font-display text-xl">Record Payment</DialogTitle>
          <p className="text-sm text-[var(--muted)]">Collect dues from {active?.name}</p>
          <form onSubmit={handlePayment} className="mt-3 space-y-4">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">Amount (₹)</label>
              <Input required type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">Mode</label>
              <select className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink)]"
                value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">Notes</label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional reference" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
                {saving ? "Saving…" : "Record payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs bg-[var(--panel)] text-[var(--ink)] text-center flex flex-col items-center">
          <DialogTitle className="font-display text-lg">UPI QR Code</DialogTitle>
          <p className="text-xs text-[var(--muted)]">Scan to pay for {active?.name}</p>
          <div className="mt-4 flex h-52 w-52 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)]">
            {qrCodeUrl
              ? <img src={qrCodeUrl} alt="QR" className="h-44 w-44 object-contain" />
              : <LoaderCircle className="animate-spin text-[var(--accent)]" size={32} />
            }
          </div>
          <p className="mt-3 text-sm font-semibold text-amber-600">Due: {money(active?.outstandingBalance ?? 0)}</p>
          <Button onClick={() => setQrOpen(false)} className="mt-4 w-full bg-[var(--ink)] text-[var(--paper)] hover:opacity-90">Done</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
