import axios from "axios";
import { api } from "@/lib/api";

import type { ProductDetail, ProductFormValues, ProductSummary } from "./types";

type ApiResponse<T> = { data: T };

function createPayload(values: ProductFormValues) {
  return {
    name: values.name,
    sku: values.sku || null,
    barcode: values.barcode || null,
    category: values.category || null,
    pricing: {
      sellingPrice: values.sellingPrice,
      costPrice: values.costPrice || null,
      currency: values.currency,
      taxRate: values.taxRate,
    },
    inventory: {
      openingQuantity: values.quantityOnHand,
      reorderLevel: values.reorderLevel,
      unit: values.unit,
      trackInventory: values.trackInventory,
    },
  };
}

export async function listProducts(query = ""): Promise<ProductSummary[]> {
  const res = await api.get<ApiResponse<ProductSummary[]>>(
    "/inventory/products",
    { params: query ? { query } : undefined },
  );
  return res.data.data;
}

export async function getProduct(id: string): Promise<ProductDetail> {
  return (await api.get<ApiResponse<ProductDetail>>(`/inventory/products/${id}`)).data.data;
}

export async function createProduct(values: ProductFormValues): Promise<ProductDetail> {
  return (await api.post<ApiResponse<ProductDetail>>("/inventory/products", createPayload(values))).data.data;
}

export async function updateProduct(id: string, version: number, values: ProductFormValues): Promise<ProductDetail> {
  const payload = createPayload(values);
  return (await api.patch<ApiResponse<ProductDetail>>(`/inventory/products/${id}`, {
    ...payload,
    inventory: { reorderLevel: values.reorderLevel, unit: values.unit, trackInventory: values.trackInventory },
    version,
  })).data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/inventory/products/${id}`);
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? "Unable to complete the request. Please try again.";
  }
  return "Unable to complete the request. Please try again.";
}
