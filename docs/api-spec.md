# KhataFlow MVP REST API Specification

**Version:** `v1`  
**Base URL:** `/api/v1`  
**Format:** JSON (`application/json`) unless an endpoint explicitly accepts `multipart/form-data`.

## API conventions

- API resources are scoped to the authenticated user's business. Clients never send `businessId`.
- Resource identifiers in paths are public UUIDs, never MongoDB `_id` values.
- Datetimes are ISO 8601 UTC strings; money values are decimal strings (for example, `"125.50"`); currency is ISO 4217.
- All list endpoints accept `limit` (default `25`, maximum `100`) and an opaque `cursor` where pagination is applicable.
- Successful single-resource responses use `{ "data": { ... } }`; lists use `{ "data": [...], "nextCursor": "..." }`.
- Errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`.
- Authenticated requests use `Authorization: Bearer <access-token>`. Role requirements are evaluated server-side.

## Common error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Malformed input or unsupported workflow state. |
| 401 | `UNAUTHENTICATED` | Missing, expired, or invalid access token. |
| 403 | `FORBIDDEN` | Authenticated user lacks the required role or tenant access. |
| 404 | `NOT_FOUND` | Resource is absent in the current business. |
| 409 | `CONFLICT` | Duplicate, stale version, or incompatible state transition. |
| 422 | `VALIDATION_ERROR` | Request did not satisfy schema or domain validation. |
| 429 | `RATE_LIMITED` | Request quota exceeded. |
| 500 | `INTERNAL_ERROR` | Unexpected service failure. |

## Authentication

### Register the first business owner

- **POST** `/auth/register`
- **Purpose:** Create a business and its initial owner account.
- **Request body:**

```json
{ "businessName": "Kumar Stores", "name": "Anita Kumar", "email": "anita@example.com", "password": "...", "phone": "+919876543210" }
```

- **Response body:** `201` with `{ "data": { "user": { "id": "uuid", "role": "owner" }, "business": { "id": "uuid", "name": "Kumar Stores" }, "accessToken": "...", "refreshToken": "..." } }`.
- **Success codes:** `201`.
- **Error codes:** `409` `EMAIL_ALREADY_REGISTERED`; `422` `VALIDATION_ERROR`; `429` `RATE_LIMITED`.
- **Authentication:** Not required.

### Sign in

- **POST** `/auth/login`
- **Purpose:** Start an authenticated staff session.
- **Request body:** `{ "email": "anita@example.com", "password": "..." }`.
- **Response body:** `200` with `{ "data": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900, "user": { "id": "uuid", "name": "Anita Kumar", "roles": ["owner"] } } }`.
- **Success codes:** `200`.
- **Error codes:** `401` `INVALID_CREDENTIALS`; `403` `ACCOUNT_DISABLED`; `429` `RATE_LIMITED`.
- **Authentication:** Not required.

### Refresh a session

- **POST** `/auth/token/refresh`
- **Purpose:** Exchange a valid refresh token for a short-lived access token.
- **Request body:** `{ "refreshToken": "..." }`.
- **Response body:** `200` with `{ "data": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 } }`.
- **Success codes:** `200`.
- **Error codes:** `401` `INVALID_REFRESH_TOKEN`; `429` `RATE_LIMITED`.
- **Authentication:** Not required.

### Sign out

- **POST** `/auth/logout`
- **Purpose:** Revoke the current refresh-token session.
- **Request body:** `{ "refreshToken": "..." }`.
- **Response body:** `204` with no body.
- **Success codes:** `204`.
- **Error codes:** `401` `INVALID_REFRESH_TOKEN`.
- **Authentication:** Required.

### Get current identity

- **GET** `/auth/me`
- **Purpose:** Load the authenticated user, business, and capabilities.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "user": { "id": "uuid", "name": "Anita Kumar", "roles": ["owner"] }, "business": { "id": "uuid", "name": "Kumar Stores", "currency": "INR" }, "capabilities": ["inventory.write"] } }`.
- **Success codes:** `200`.
- **Error codes:** `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

## Inventory

### Browse the catalogue

- **GET** `/inventory/products?query=&category=&stockStatus=&cursor=&limit=`
- **Purpose:** Search products and inspect current stock state.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "id": "uuid", "name": "Rice 5 kg", "sku": "RICE-5", "sellingPrice": "350.00", "currency": "INR", "quantityOnHand": "12", "reorderLevel": "5", "stockStatus": "in_stock" }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_FILTER`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### Add a catalogue product

- **POST** `/inventory/products`
- **Purpose:** Register a sellable item and its opening stock.
- **Request body:** `{ "name": "Rice 5 kg", "sku": "RICE-5", "barcode": "8901234567890", "category": "Groceries", "pricing": { "sellingPrice": "350.00", "costPrice": "290.00", "currency": "INR", "taxRate": "5" }, "inventory": { "openingQuantity": "12", "reorderLevel": "5", "unit": "bag" }, "supplierIds": ["uuid"] }`.
- **Response body:** `201` with `{ "data": { "id": "uuid", "name": "Rice 5 kg", "quantityOnHand": "12", "createdAt": "2026-07-23T10:00:00Z" } }`.
- **Success codes:** `201`.
- **Error codes:** `409` `DUPLICATE_SKU` or `DUPLICATE_BARCODE`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`.

### View a product and stock history

- **GET** `/inventory/products/{productId}`
- **Purpose:** Retrieve the product, supplier references, stock balance, and recent movements.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "name": "Rice 5 kg", "pricing": {}, "inventory": { "quantityOnHand": "12", "reorderLevel": "5" }, "recentMovements": [{ "type": "sale", "quantityDelta": "-1", "occurredAt": "..." }] } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `PRODUCT_NOT_FOUND`.
- **Authentication:** Required.

### Change a product's selling configuration

- **PATCH** `/inventory/products/{productId}/configuration`
- **Purpose:** Update product name, category, pricing, reorder level, suppliers, or active state without altering historical transactions.
- **Request body:** `{ "name": "Rice 5 kg", "pricing": { "sellingPrice": "360.00", "currency": "INR", "taxRate": "5" }, "reorderLevel": "6", "version": 3 }`.
- **Response body:** `200` with `{ "data": { "id": "uuid", "version": 4, "updatedAt": "..." } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `PRODUCT_NOT_FOUND`; `409` `STALE_VERSION`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`.

### Record a stock adjustment

- **POST** `/inventory/products/{productId}/adjustments`
- **Purpose:** Record a count correction, damage, expiry, or opening-balance correction as an auditable movement.
- **Request body:** `{ "quantityDelta": "-2", "reason": "damaged", "note": "Two bags damaged in transit", "occurredAt": "2026-07-23T09:30:00Z" }`.
- **Response body:** `201` with `{ "data": { "movementId": "uuid", "productId": "uuid", "quantityOnHand": "10", "type": "adjustment" } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `PRODUCT_NOT_FOUND`; `409` `INSUFFICIENT_STOCK`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`.

### Review replenishment needs

- **GET** `/inventory/reorder-queue?cursor=&limit=`
- **Purpose:** Return products at or below their configured reorder level.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "productId": "uuid", "name": "Rice 5 kg", "quantityOnHand": "3", "reorderLevel": "5", "suggestedOrderQuantity": "12" }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

## Customers

### Find customers

- **GET** `/customers?query=&creditStatus=&cursor=&limit=`
- **Purpose:** Search customers and view credit balances.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "id": "uuid", "name": "Ravi", "phone": "+919876543210", "outstandingBalance": "500.00", "creditLimit": "2000.00" }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_FILTER`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### Enrol a customer

- **POST** `/customers`
- **Purpose:** Create a customer profile for sales, credit, and relationship tracking.
- **Request body:** `{ "contact": { "name": "Ravi", "phone": "+919876543210", "email": "ravi@example.com", "address": {} }, "creditLimit": "2000.00", "tags": ["regular"] }`.
- **Response body:** `201` with `{ "data": { "id": "uuid", "name": "Ravi", "outstandingBalance": "0.00", "createdAt": "..." } }`.
- **Success codes:** `201`.
- **Error codes:** `409` `DUPLICATE_CUSTOMER`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required.

### View a customer account

- **GET** `/customers/{customerId}`
- **Purpose:** View profile, credit status, recent transactions, and balance summary.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "contact": {}, "credit": { "limit": "2000.00", "outstandingBalance": "500.00", "availableCredit": "1500.00" }, "recentTransactions": [] } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `CUSTOMER_NOT_FOUND`.
- **Authentication:** Required.

### Update customer relationship details

- **PATCH** `/customers/{customerId}/profile`
- **Purpose:** Change contact information, address, tags, preferences, or credit limit.
- **Request body:** `{ "contact": { "name": "Ravi", "phone": "+919876543210" }, "creditLimit": "2500.00", "tags": ["regular", "wholesale"], "version": 2 }`.
- **Response body:** `200` with `{ "data": { "id": "uuid", "version": 3, "updatedAt": "..." } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `CUSTOMER_NOT_FOUND`; `409` `STALE_VERSION`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`.

### Record a customer credit settlement

- **POST** `/customers/{customerId}/settlements`
- **Purpose:** Record payment against an outstanding credit balance.
- **Request body:** `{ "amount": "500.00", "method": "upi", "reference": "UPI-123", "receivedAt": "2026-07-23T10:00:00Z", "note": "July payment" }`.
- **Response body:** `201` with `{ "data": { "settlementId": "uuid", "outstandingBalance": "0.00", "transactionId": "uuid" } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `CUSTOMER_NOT_FOUND`; `409` `SETTLEMENT_EXCEEDS_BALANCE`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`.

## Transactions

### Record a manual transaction

- **POST** `/transactions/manual`
- **Purpose:** Post a sale, purchase, return, or adjustment entered by staff.
- **Request body:** `{ "transactionType": "sale", "occurredAt": "2026-07-23T10:00:00Z", "customerId": "uuid", "lineItems": [{ "productId": "uuid", "quantity": "2", "unitPrice": "350.00", "discountAmount": "0", "taxRate": "5" }], "payments": [{ "method": "cash", "amount": "735.00" }], "notes": "" }`.
- **Response body:** `201` with `{ "data": { "id": "uuid", "status": "posted", "inputType": "manual", "grandTotal": "735.00", "currency": "INR", "inventoryApplied": true } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `PRODUCT_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, or `SUPPLIER_NOT_FOUND`; `409` `INSUFFICIENT_STOCK`, `CREDIT_LIMIT_EXCEEDED`, or `DUPLICATE_SUBMISSION`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`. Supports `Idempotency-Key`.

### Browse the transaction ledger

- **GET** `/transactions?type=&customerId=&supplierId=&from=&to=&inputType=&cursor=&limit=`
- **Purpose:** Filter the business ledger for operations and reporting.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "id": "uuid", "transactionType": "sale", "occurredAt": "...", "grandTotal": "735.00", "currency": "INR", "inputType": "manual" }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_FILTER`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### View a posted transaction

- **GET** `/transactions/{transactionId}`
- **Purpose:** Retrieve the immutable transaction snapshot, payment breakdown, source capture, and audit history.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "status": "posted", "lineItems": [], "payments": [], "totals": { "subtotal": "700.00", "tax": "35.00", "grandTotal": "735.00" }, "source": {} } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `TRANSACTION_NOT_FOUND`.
- **Authentication:** Required.

### Post a return against a transaction

- **POST** `/transactions/{transactionId}/returns`
- **Purpose:** Create a linked, auditable return rather than editing the original sale.
- **Request body:** `{ "items": [{ "lineItemId": "uuid", "quantity": "1", "reason": "damaged" }], "refund": { "method": "cash", "amount": "367.50" }, "occurredAt": "2026-07-23T12:00:00Z" }`.
- **Response body:** `201` with `{ "data": { "id": "uuid", "transactionType": "return", "originalTransactionId": "uuid", "grandTotal": "367.50", "inventoryApplied": true } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `TRANSACTION_NOT_FOUND`; `409` `RETURN_QUANTITY_EXCEEDED` or `RETURN_NOT_ALLOWED`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`.

### Void an incorrect transaction

- **POST** `/transactions/{transactionId}/void`
- **Purpose:** Record a controlled reversal before the configured accounting cutoff; the original remains auditable.
- **Request body:** `{ "reason": "duplicate entry", "note": "Second manual entry", "version": 1 }`.
- **Response body:** `200` with `{ "data": { "id": "uuid", "status": "voided", "reversalTransactionId": "uuid", "voidedAt": "..." } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `TRANSACTION_NOT_FOUND`; `409` `VOID_NOT_ALLOWED` or `STALE_VERSION`; `403` `FORBIDDEN`.
- **Authentication:** Required; `owner` or `manager`.

## Voice Processing

### Create a voice capture

- **POST** `/voice/captures`
- **Purpose:** Upload a voice note for asynchronous transcription and transaction extraction.
- **Request body:** `multipart/form-data` with `audio` (required), optional `language`, and optional `clientCapturedAt`.
- **Response body:** `202` with `{ "data": { "captureId": "uuid", "status": "queued", "statusUrl": "/api/v1/voice/captures/uuid" } }`.
- **Success codes:** `202`.
- **Error codes:** `413` `FILE_TOO_LARGE`; `415` `UNSUPPORTED_AUDIO_FORMAT`; `422` `VALIDATION_ERROR`; `429` `RATE_LIMITED`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`.

### Inspect extracted voice data

- **GET** `/voice/captures/{captureId}`
- **Purpose:** Poll capture processing status and retrieve the AI-proposed transaction draft for review.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "status": "ready", "transcript": "Two bags of rice", "confidence": 0.92, "draft": { "transactionType": "sale", "lineItems": [] }, "warnings": [] } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `VOICE_CAPTURE_NOT_FOUND`; `409` `CAPTURE_NOT_READY`.
- **Authentication:** Required.

### Confirm a voice-derived transaction

- **POST** `/voice/captures/{captureId}/confirm`
- **Purpose:** Human-review and post the final transaction using the voice capture as provenance.
- **Request body:** `{ "draft": { "transactionType": "sale", "customerId": "uuid", "lineItems": [], "payments": [] }, "confirmations": ["price_verified"] }`.
- **Response body:** `201` with `{ "data": { "transactionId": "uuid", "captureId": "uuid", "status": "posted", "inputType": "voice" } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `VOICE_CAPTURE_NOT_FOUND`; `409` `CAPTURE_ALREADY_CONFIRMED`, `CAPTURE_NOT_READY`, or `INSUFFICIENT_STOCK`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`. Supports `Idempotency-Key`.

## Receipt Processing

### Create a receipt capture

- **POST** `/receipts/captures`
- **Purpose:** Upload a receipt or invoice image/PDF for asynchronous OCR and transaction extraction.
- **Request body:** `multipart/form-data` with `file` (required), optional `transactionTypeHint` (`sale` or `purchase`), and optional `capturedAt`.
- **Response body:** `202` with `{ "data": { "captureId": "uuid", "status": "queued", "statusUrl": "/api/v1/receipts/captures/uuid" } }`.
- **Success codes:** `202`.
- **Error codes:** `413` `FILE_TOO_LARGE`; `415` `UNSUPPORTED_RECEIPT_FORMAT`; `422` `VALIDATION_ERROR`; `429` `RATE_LIMITED`.
- **Authentication:** Required; `owner`, `manager`, or permitted `staff`.

### Inspect extracted receipt data

- **GET** `/receipts/captures/{captureId}`
- **Purpose:** Poll OCR/extraction status and retrieve the reviewable transaction draft.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "status": "ready", "documentUrl": "signed-url", "extractionConfidence": 0.89, "draft": { "transactionType": "purchase", "supplier": { "name": "" }, "lineItems": [] }, "warnings": [] } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `RECEIPT_CAPTURE_NOT_FOUND`; `409` `CAPTURE_NOT_READY`.
- **Authentication:** Required.

### Confirm a receipt-derived transaction

- **POST** `/receipts/captures/{captureId}/confirm`
- **Purpose:** Review, correct, and post a transaction with receipt provenance.
- **Request body:** `{ "draft": { "transactionType": "purchase", "supplierId": "uuid", "lineItems": [], "payments": [] }, "createMissingProducts": false, "confirmations": ["supplier_verified"] }`.
- **Response body:** `201` with `{ "data": { "transactionId": "uuid", "captureId": "uuid", "status": "posted", "inputType": "receipt", "createdProducts": [] } }`.
- **Success codes:** `201`.
- **Error codes:** `404` `RECEIPT_CAPTURE_NOT_FOUND`; `409` `CAPTURE_ALREADY_CONFIRMED` or `CAPTURE_NOT_READY`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`. Supports `Idempotency-Key`.

## Dashboard

### Load the operational overview

- **GET** `/dashboard/overview?from=&to=&timezone=`
- **Purpose:** Provide the primary back-office view: sales, purchases, cash flow, stock risk, credit, and pending actions.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "period": { "from": "...", "to": "...", "timezone": "Asia/Kolkata" }, "sales": { "total": "25000.00", "count": 42 }, "purchases": { "total": "8000.00" }, "cashflow": { "in": "25000.00", "out": "8000.00" }, "lowStockCount": 4, "outstandingCredit": "3500.00", "unreadNotifications": 2 } }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_DATE_RANGE`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### Load sales and inventory trends

- **GET** `/dashboard/trends?metric=sales|purchases|gross_margin|inventory&interval=day|week|month&from=&to=`
- **Purpose:** Fetch time-series data for the selected operational metric.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "metric": "sales", "currency": "INR", "series": [{ "period": "2026-07-23", "value": "2500.00" }] } }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_METRIC` or `INVALID_DATE_RANGE`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

## AI Insights

### Review generated insights

- **GET** `/ai-insights?category=&severity=&status=open|acknowledged|dismissed&cursor=&limit=`
- **Purpose:** List actionable, tenant-scoped AI findings.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "id": "uuid", "category": "inventory", "severity": "high", "title": "Rice stock may run out", "confidence": 0.91, "suggestedAction": "Order 12 bags", "status": "open", "generatedAt": "..." }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_FILTER`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### View insight evidence

- **GET** `/ai-insights/{insightId}`
- **Purpose:** Retrieve full evidence, provenance, related records, and explanation.
- **Request body:** None.
- **Response body:** `200` with `{ "data": { "id": "uuid", "summary": "...", "evidence": [{ "sourceType": "transaction", "sourceId": "uuid", "description": "..." }], "agent": { "name": "inventory-agent", "modelVersion": "..." }, "status": "open" } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `INSIGHT_NOT_FOUND`.
- **Authentication:** Required.

### Record insight disposition

- **POST** `/ai-insights/{insightId}/disposition`
- **Purpose:** Acknowledge, dismiss, or mark an insight actioned while preserving feedback for future agents.
- **Request body:** `{ "action": "actioned", "note": "Ordered 12 bags", "feedback": "useful" }`.
- **Response body:** `200` with `{ "data": { "id": "uuid", "status": "actioned", "resolvedAt": "...", "resolvedBy": "uuid" } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `INSIGHT_NOT_FOUND`; `409` `INSIGHT_ALREADY_RESOLVED`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required; `owner` or `manager`.

## Notifications

### List notifications

- **GET** `/notifications?status=unread|read&cursor=&limit=`
- **Purpose:** Retrieve in-app notifications for the authenticated user.
- **Request body:** None.
- **Response body:** `200` with `{ "data": [{ "id": "uuid", "title": "Low stock", "body": "Rice stock is below reorder level", "channel": "in_app", "status": "pending", "createdAt": "..." }], "nextCursor": null }`.
- **Success codes:** `200`.
- **Error codes:** `400` `INVALID_FILTER`; `401` `UNAUTHENTICATED`.
- **Authentication:** Required.

### Mark notifications as read

- **POST** `/notifications/read`
- **Purpose:** Mark one or more of the current user's notifications as read.
- **Request body:** `{ "notificationIds": ["uuid", "uuid"] }`.
- **Response body:** `200` with `{ "data": { "updatedCount": 2, "readAt": "..." } }`.
- **Success codes:** `200`.
- **Error codes:** `404` `NOTIFICATION_NOT_FOUND`; `422` `VALIDATION_ERROR`.
- **Authentication:** Required.

### Manage notification preferences

- **PATCH** `/notifications/preferences`
- **Purpose:** Configure the current user's permitted delivery channels and event preferences.
- **Request body:** `{ "channels": { "inApp": true, "push": true, "email": false, "whatsapp": false }, "events": { "lowStock": true, "aiInsights": true, "paymentDue": true } }`.
- **Response body:** `200` with `{ "data": { "channels": {}, "events": {}, "updatedAt": "..." } }`.
- **Success codes:** `200`.
- **Error codes:** `422` `VALIDATION_ERROR`.
- **Authentication:** Required.
