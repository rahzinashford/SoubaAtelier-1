# MUTATION_VALIDATION_COVERAGE_REPORT

## Coverage Summary

- **Total mutation endpoints (request-body mutations):** 24
- **Validated via Zod:** 24
- **Not validated:** 0
- **Validation coverage:** 100%

## Fixes Implemented

Added/used Zod validation on previously unvalidated request-body mutations:

1. `POST /api/cart` → `addToCartSchema`
2. `PATCH /api/cart/item/:id` → `updateCartItemQuantitySchema`
3. `POST /api/orders` → `createOrderSchema`
4. `POST /api/auth/login` → `loginSchema`
5. `POST /api/admin/products/bulk` → `adminBulkProductsSchema`
6. `POST /api/admin/products/import` → `adminImportProductsSchema`
7. `POST /api/admin/users/:id/revoke-sessions` → `revokeSessionsSchema`
8. `POST /api/admin/products/:id/adjust-stock` → `adjustStockSchema`
9. `POST /api/admin/orders/:id/notes` → `adminOrderNoteCreateSchema`
10. `PATCH /api/admin/settings` → `adminSettingUpdateSchema`

Also added explicit `ZodError` handling in these route catch blocks so invalid payloads return `400` instead of `500`.

## Return

- **Validation coverage:** **100%**
- **Any unvalidated mutation left:** **NO**
- **Target: 100%** ✅
