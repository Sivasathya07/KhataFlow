export type ProductSummary = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  sellingPrice: string;
  currency: string;
  quantityOnHand: string;
  reorderLevel: string;
  unit: string;
  isActive: boolean;
  version: number;
};

export type ProductDetail = ProductSummary & {
  costPrice: string | null;
  taxRate: string;
  trackInventory: boolean;
  supplierIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  sellingPrice: string;
  costPrice: string;
  currency: string;
  taxRate: string;
  quantityOnHand: string;
  reorderLevel: string;
  unit: string;
  trackInventory: boolean;
};
