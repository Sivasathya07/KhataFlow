# MongoDB data model

KhataFlow stores each top-level entity in its own collection: `users`, `customers`, `products`, `transactions`, `suppliers`, `notifications`, and `ai_insights`.

Every top-level Pydantic document has a MongoDB `_id` (`ObjectId`), a public UUID (`publicId`), `createdAt`, `updatedAt`, and `aiMetadata`. `businessId` is a UUID used to partition all tenant-owned documents. Cross-collection relationships use BSON ObjectIds: for example, `transactions.customerId`, `transactions.supplierId`, `transactions.lineItems.productId`, `products.supplierIds`, and `notifications.recipientUserId`.

Nested value objects, such as addresses, pricing, inventory, transaction line items, payments, input captures, and insight evidence, are embedded to preserve a consistent snapshot and minimize reads.

## Transaction capture

`transactions.input.inputType` is constrained to `voice`, `receipt`, or `manual`. The input record can retain raw text, a receipt file URL, extraction confidence, and agent metadata without coupling the transaction model to a specific AI provider.

Line items are immutable transaction-time product snapshots: they keep the product reference plus name, SKU, quantity, price, discounts, taxes, and line total. This protects historical reporting if the product catalogue later changes.

## Recommended indexes

Create these indexes when the MongoDB database integration is added:

- All tenant collections: `{ businessId: 1, createdAt: -1 }`
- `users`: unique `{ businessId: 1, email: 1 }`
- `customers`: `{ businessId: 1, "contact.phone": 1 }`, `{ businessId: 1, "contact.name": 1 }`
- `products`: unique partial indexes on `{ businessId: 1, sku: 1 }` and `{ businessId: 1, barcode: 1 }`; `{ businessId: 1, "inventory.quantityOnHand": 1 }`
- `transactions`: `{ businessId: 1, occurredAt: -1 }`, `{ customerId: 1, occurredAt: -1 }`, `{ supplierId: 1, occurredAt: -1 }`, `{ "lineItems.productId": 1, occurredAt: -1 }`
- `notifications`: `{ recipientUserId: 1, status: 1, createdAt: -1 }`
- `ai_insights`: `{ businessId: 1, category: 1, generatedAt: -1 }`, `{ businessId: 1, severity: 1, generatedAt: -1 }`
