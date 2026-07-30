import { PackagePlus, Search, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createProduct, deleteProduct, getApiError, getProduct, listProducts, updateProduct } from "./api";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductTable } from "./product-table";
import type { ProductDetail, ProductFormValues, ProductSummary } from "./types";

export function InventoryPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = async (query = search) => {
    setLoading(true);
    setError(null);
    try { setProducts(await listProducts(query)); }
    catch (e) { setError(getApiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { void loadProducts(search); }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const startEdit = async (p: ProductSummary) => {
    setError(null);
    try { setEditingProduct(await getProduct(p.id)); setFormError(null); setFormOpen(true); }
    catch (e) { setError(getApiError(e)); }
  };

  const submitForm = async (values: ProductFormValues) => {
    setSaving(true); setFormError(null);
    try {
      if (editingProduct) await updateProduct(editingProduct.id, editingProduct.version, values);
      else await createProduct(values);
      setFormOpen(false); setEditingProduct(null); await loadProducts();
    } catch (e) { setFormError(getApiError(e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await deleteProduct(deleteTarget.id); setDeleteTarget(null); await loadProducts(); }
    catch (e) { setError(getApiError(e)); }
    finally { setDeleting(false); }
  };

  return (
    <main className="page-shell">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalogue, pricing, and stock thresholds.</p>
        </div>
        <Button
          className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shrink-0"
          onClick={() => { setEditingProduct(null); setFormError(null); setFormOpen(true); }}
        >
          <PackagePlus className="mr-2" size={17} /> Add product
        </Button>
      </div>

      <div className="surface-panel overflow-hidden">
        {/* Search bar */}
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, or barcode"
            />
          </div>
          <p className="text-sm text-[var(--muted)]">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>

        {error && (
          <div role="alert" className="m-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
            <Button variant="ghost" className="h-8 text-xs" onClick={() => void loadProducts()}>Retry</Button>
          </div>
        )}

        {loading ? (
          <p className="p-12 text-center text-sm text-[var(--muted)]">Loading products…</p>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="font-semibold text-[var(--ink)]">No products found</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {search ? "Try a different search term." : "Add your first product to start managing stock."}
            </p>
            {!search && (
              <Button
                className="mt-5 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                onClick={() => setFormOpen(true)}
              >
                Add product
              </Button>
            )}
          </div>
        ) : (
          <ProductTable products={products} onEdit={startEdit} onDelete={setDeleteTarget} />
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        product={editingProduct}
        isSaving={saving}
        error={formError}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingProduct(null); }}
        onSubmit={(v) => void submitForm(v)}
      />
      <DeleteProductDialog
        product={deleteTarget}
        isDeleting={deleting}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => void confirmDelete()}
      />
    </main>
  );
}
