import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProductDetail, ProductFormValues } from "./types";

const blankValues: ProductFormValues = {
  name: "", sku: "", barcode: "", category: "",
  sellingPrice: "", costPrice: "", currency: "INR",
  taxRate: "0", quantityOnHand: "0", reorderLevel: "0",
  unit: "unit", trackInventory: true,
};

function valuesFromProduct(p: ProductDetail | null): ProductFormValues {
  if (!p) return blankValues;
  return {
    name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", category: p.category ?? "",
    sellingPrice: p.sellingPrice, costPrice: p.costPrice ?? "", currency: p.currency,
    taxRate: p.taxRate, quantityOnHand: p.quantityOnHand, reorderLevel: p.reorderLevel,
    unit: p.unit, trackInventory: p.trackInventory,
  };
}

type Props = {
  open: boolean;
  product: ProductDetail | null;
  isSaving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProductFormValues) => void;
};

export function ProductFormDialog({ open, product, isSaving, error, onOpenChange, onSubmit }: Props) {
  const [values, setValues] = useState<ProductFormValues>(blankValues);
  const isEditing = Boolean(product);

  useEffect(() => { if (open) setValues(valuesFromProduct(product)); }, [open, product]);

  const set = (key: keyof ProductFormValues, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{isEditing ? "Edit product" : "Add product"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update catalogue details. Stock changes go through inventory movements."
            : "Add a product with its opening stock balance."}
        </DialogDescription>
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" required>
              <Input required value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Rice 5 kg" />
            </Field>
            <Field label="Category">
              <Input value={values.category} onChange={(e) => set("category", e.target.value)} placeholder="Groceries" />
            </Field>
            <Field label="SKU">
              <Input value={values.sku} onChange={(e) => set("sku", e.target.value)} placeholder="RICE-5" />
            </Field>
            <Field label="Barcode">
              <Input value={values.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </Field>
            <Field label="Selling price" required>
              <Input required type="number" min="0.01" step="0.01" inputMode="decimal"
                value={values.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} />
            </Field>
            <Field label="Cost price">
              <Input type="number" min="0" step="0.01" inputMode="decimal"
                value={values.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
            </Field>
            <Field label="Currency" required>
              <Input required maxLength={3}
                value={values.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Tax rate (%)">
              <Input type="number" min="0" max="100" step="0.01"
                value={values.taxRate} onChange={(e) => set("taxRate", e.target.value)} />
            </Field>
            {!isEditing && (
              <Field label="Opening quantity">
                <Input type="number" min="0" step="0.001"
                  value={values.quantityOnHand} onChange={(e) => set("quantityOnHand", e.target.value)} />
              </Field>
            )}
            <Field label="Reorder level">
              <Input type="number" min="0" step="0.001"
                value={values.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} />
            </Field>
            <Field label="Unit">
              <Input required value={values.unit} onChange={(e) => set("unit", e.target.value)} placeholder="unit" />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[var(--ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={values.trackInventory}
              onChange={(e) => set("trackInventory", e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
            />
            Track inventory movements
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
            >
              {isSaving ? "Saving…" : isEditing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--ink)]">
      <span>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
