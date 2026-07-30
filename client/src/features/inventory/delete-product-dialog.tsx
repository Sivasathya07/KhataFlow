import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { ProductSummary } from "./types";

type Props = { product: ProductSummary | null; isDeleting: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void };

export function DeleteProductDialog({ product, isDeleting, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Delete product?</AlertDialogTitle>
        <AlertDialogDescription>This will permanently remove <strong>{product?.name}</strong> from the catalogue. Historical transaction records should be retained separately.</AlertDialogDescription>
        <div className="mt-6 flex justify-end gap-3"><AlertDialogCancel asChild><Button variant="outline">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" disabled={isDeleting} onClick={onConfirm}>{isDeleting ? "Deleting…" : "Delete product"}</Button></AlertDialogAction></div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
