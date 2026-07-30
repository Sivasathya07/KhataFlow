import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import type { ProductSummary } from "./types";

type Props = {
  products: ProductSummary[];
  onEdit: (p: ProductSummary) => void;
  onDelete: (p: ProductSummary) => void;
};

export function ProductTable({ products, onEdit, onDelete }: Props) {
  return (
    <Table>
      <thead className="border-b border-[var(--line)] bg-[var(--paper-strong)]">
        <tr>
          {["Product", "SKU", "Price", "Stock", "Status", ""].map((h) => (
            <TableHead key={h} className={h === "" ? "text-right" : ""}>{h}</TableHead>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--line)]">
        {products.map((p) => (
          <TableRow key={p.id} className="hover:bg-[var(--panel-hover)] transition">
            <TableCell>
              <div className="font-medium text-[var(--ink)]">{p.name}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">{p.category ?? "Uncategorised"}</div>
            </TableCell>
            <TableCell className="text-[var(--muted)]">{p.sku ?? "—"}</TableCell>
            <TableCell className="font-medium text-[var(--ink)]">{p.currency} {p.sellingPrice}</TableCell>
            <TableCell>
              <span className={
                Number(p.quantityOnHand) <= Number(p.reorderLevel)
                  ? "font-semibold text-amber-600"
                  : "text-[var(--ink)]"
              }>
                {p.quantityOnHand} {p.unit}
              </span>
            </TableCell>
            <TableCell>
              <span className={
                p.isActive
                  ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100"
                  : "rounded-full bg-[var(--paper-strong)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)] border border-[var(--line)]"
              }>
                {p.isActive ? "Active" : "Inactive"}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => onEdit(p)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => onDelete(p)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}
