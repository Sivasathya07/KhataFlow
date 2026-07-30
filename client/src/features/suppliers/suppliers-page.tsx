import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Plus, Truck } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxIdentifier?: string | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
}

interface Product {
  id: string;
  name: string;
}

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [active, setActive] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.get<{ data: Supplier[] }>("/suppliers"),
        api.get<{ data: Product[] }>("/inventory/products", { params: { limit: 100 } }),
      ]);
      setSuppliers(s.data.data);
      setProducts(p.data.data);
      setError(null);
    } catch {
      setError("Could not load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/suppliers", { name, phone: phone || null, contactName: contactName || null });
      setCreateOpen(false);
      setName("");
      setPhone("");
      setContactName("");
      await load();
    } catch {
      setError("Could not create supplier.");
    } finally {
      setSaving(false);
    }
  };

  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !productId) return;
    setSaving(true);
    try {
      await api.post(`/suppliers/${active.id}/receive`, {
        lines: [{ productId, quantity: Number(quantity), unitCost: unitCost ? Number(unitCost) : null }],
        notes: "Purchase receive",
      });
      setReceiveOpen(false);
      setProductId("");
      setQuantity("1");
      setUnitCost("");
      await load();
    } catch {
      setError("Could not receive stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Procurement</p>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">Vendor directory and purchase receiving into stock.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
          <Plus size={16} className="mr-2" /> Add supplier
        </Button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Card className="surface-panel overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-[var(--accent-strong)]">
                    <Truck size={18} />
                  </span>
                  <div>
                    <p className="font-semibold">{supplier.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {supplier.contactName || "No contact"} · {supplier.phone || "No phone"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActive(supplier);
                    setReceiveOpen(true);
                  }}
                >
                  Receive stock
                </Button>
              </div>
            ))}
            {!suppliers.length && <p className="p-6 text-sm text-[var(--muted)]">No suppliers yet.</p>}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>Add supplier</DialogTitle>
          <form onSubmit={create} className="mt-4 space-y-3">
            <Input required placeholder="Supplier name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button disabled={saving} className="w-full bg-[var(--accent)] text-white">{saving ? "Saving…" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogTitle>Receive from {active?.name}</DialogTitle>
          <form onSubmit={receive} className="mt-4 space-y-3">
            <select required className="h-10 w-full rounded-md border border-[var(--line)] px-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Input required type="number" min={0.001} step="any" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input type="number" min={0} step="any" placeholder="Unit cost (optional)" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <Button disabled={saving} className="w-full bg-[var(--accent)] text-white">{saving ? "Receiving…" : "Stock in"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
