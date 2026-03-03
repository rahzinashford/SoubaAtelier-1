# TOTAL SYSTEM CERTIFICATION REPORT (ZERO-TRUST)

**Target:** Souba Atelier (`/workspace/SoubaAtelier-1`)  
**Method:** Zero-trust static certification with limited runtime validation available in this environment.  
**Rule:** Nothing assumed correct unless evidenced; otherwise marked **Not verifiable in this environment**.

---

## Verification Scope & Constraints

### What was verified directly
- Frontend routing graph and guard wrappers.
- React context logic (Auth, Cart, Currency).
- Frontend API call map vs backend route map.
- Backend route protection and ownership checks.
- Checkout transaction structure and rollback semantics (code-level).
- DB schema, FK/index definitions, and migration alignment.
- Auth middleware/token semantics.
- Upload/middleware/security headers/rate-limit implementation.
- Production build validity (`npm run build`).

### Not verifiable in this environment
- Real DB-backed transactional execution under concurrent load.
- Live browser interaction and network throttling simulation.
- Real deployment-level configuration and process manager settings.
- OS-level disk-full/permission-failure runtime behavior in production container.

---

## SECTION 1 – FRONTEND DEEP VALIDATION

### 1.1 Routing
- React Router routes exist for all imported pages in `App.jsx`.
- One orphan page file exists: `client/src/pages/not-found.jsx` (unused; route uses `NotFoundPage.jsx`).
- No duplicate route path declarations found in `App.jsx`.
- Reachability:
  - Public routes reachable.
  - Protected routes (`/checkout`, `/profile`) and admin route (`/admin`) are reachable conditionally via guards.
  - `*` fallback catches unknown routes.
- Guard correctness:
  - `ProtectedRoute` redirects unauthenticated users to `/login` with `redirectTo` state.
  - `AdminRoute` redirects non-authenticated users to `/login`, non-admin users to `/`.
- Manual URL tampering simulation (static):
  - Direct navigation to protected/admin URLs is blocked by client guard logic.
  - **Important:** This is UX-only; backend authorization remains authoritative.

**Result:** Routing structure is mostly correct, with one orphan page artifact.

### 1.2 State Management
#### AuthContext
- Token persistence: stored in `safeStorage` under `authToken`.
- Invalid token purge: on `/auth/me` fetch failure, token and user are cleared.
- Role change handling:
  - Role is read from current `user` object.
  - No automatic polling/revalidation; role changes server-side require refresh/login cycle to be reflected client-side.

#### CartContext
- Reset on logout: when `isAuthenticated` false, `fetchCart()` clears local cart items.
- Backend sync after mutation: add/update/delete all refetch cart after success.
- Error recovery: errors set on failure and cleared at operation start; no advanced retry/backoff.

#### CurrencyContext
- Fallback behavior: defaults to INR when API fails or returns unsupported currency.
- Async race behavior:
  - Single initial fetch; no cancellation guard for unmount.
  - Potential benign state update-after-unmount warning in extreme timing.

### 1.3 Component Stability
- No obvious infinite re-render loops found in audited contexts/pages.
- Dependency arrays are generally present in major hooks reviewed.
- Stale closure risk: low/moderate in large pages, no critical loop identified.
- Unmounted state update protection: mostly absent (no abort/cancel patterns in async effects).

Specific checks:
- Image components missing `src` handling:
  - `ProductCard` handles missing image with placeholder.
  - Several direct `<img>` usages (e.g., wishlist/gallery) do not include explicit fallback/onError handling.
- Product gallery with `0` images:
  - `ImageGallery` reads `images[selectedIndex]` without guard; `images=[]` can render invalid src and degrade UX.
- Wishlist add-to-cart argument correctness:
  - In Profile wishlist tab, `onAddToCart` calls `addItem(product.id, 1)` while `addItem` expects a product object (`product.id` read internally). This is a functional bug path.

### 1.4 API Contract Integrity
- Frontend API modules mostly align with backend routes and methods.
- Mismatch findings:
  - Error-shape mismatch risk: frontend fetch helpers parse `{ message }` preferentially; backend response middleware normalizes errors to `{ error }`, leading to generic fallback messages in many client error paths.
  - Minor route inconsistency: backend has both `/api/orders` and `/api/my/orders`; frontend uses `/orders` only (not broken, but redundant API surface).
- No major missing backend endpoints for current frontend calls were found.

### 1.5 UX Edge Case Simulation
Simulated by code-path inspection only:
- API 401 mid-session: backend returns 401; frontend API helper throws. Automatic global logout on 401 is **not** centrally enforced.
- API 500 product list: UI should enter error path if query handler catches; behavior depends on per-page handling.
- Checkout failure: checkout endpoint returns explicit 400 error on stock/cart issues; frontend receives error string but may show generic text if expecting `message`.
- Slow network: loading states exist in several views; no timeout/retry policy.
- Empty results: generally handled for lists, but varies by page.
- Large product list: no virtualization observed; potential rendering pressure.
- Soft-deleted product in cart: checkout transaction rejects missing/deleted products.

**Frontend Stability Score (0–10): 6.4**  
**UX Resilience Score: 6.1**  
**Contract Integrity Score: 7.2**

---

## SECTION 2 – BACKEND LOGIC VERIFICATION

### 2.1 Route Inventory
- Comprehensive route set exists for products/cart/orders/auth/addresses/wishlist/admin/settings/contact.
- Duplicate route definitions: none confirmed in executable code path.
- Unprotected admin routes: none found; admin routes include `requireAuth` + `requireAdmin`.
- Missing validation:
  - Strong validation via Zod exists on many write endpoints.
  - Some endpoints still use manual checks only (e.g., stock adjustment, notes), not full schema validation.

### 2.2 Transactional Correctness
- Checkout is wrapped in DB transaction.
- Failure inside transaction throws and should rollback order/order_items/stock updates atomically.
- Explicit row-level locking (`FOR UPDATE OF ci, p`) plus conditional stock decrement reduces oversell races.
- Deadlock risk: low/moderate under high concurrent mixed cart/stock patterns; no explicit retry strategy.
- Isolation assumption: relies on DB default + row locks; acceptable but not formally proven here.

### 2.3 Ownership Enforcement
ID-based mutations reviewed:
- Cart items: ownership enforced before PATCH/DELETE via join to cart user.
- Wishlist: user-scoped by query design (`userId` + `productId`).
- Address: ownership checked in route before update/delete/default.
- Orders: `/api/orders/:id` enforces owner or admin.
- Admin operations: protected via role middleware.

### 2.4 Data Mutation Safety
- Most updates are validated (Zod) or minimally guarded.
- Deletes:
  - Product delete is soft-delete (`active=false`) with image cleanup attempt.
  - Address and wishlist are hard deletes, ownership-checked.
- Soft-delete consistency:
  - Public product reads filter `active=true`.
  - Checkout existence check does not enforce `active=true`, only existence/stock.
- Alternate-route bypass:
  - Admin product endpoints can mutate inactive products by design.
  - No obvious non-admin bypass found.

**Backend Correctness Score: 7.8**  
**Horizontal Escalation Risk: LOW–MEDIUM** (not zero due to broad API surface and manual checks).  
**Partial Write Risk: LOW** for checkout path; **MEDIUM** for non-transactional multi-step admin flows.

---

## SECTION 3 – DATABASE & DATA MODEL VALIDATION

### 3.1 Schema vs Runtime Assumption Alignment
- Major NOT NULL fields align with required business data (users/products/orders core fields).
- Potential mismatch:
  - `orders.status` DB default is lowercase `'pending'` while app writes uppercase `'PENDING'`; mixed casing risk for analytics/filtering assumptions.
- No critical nullable/required contradiction observed in core flows.

### 3.2 Referential Integrity
- FKs exist across carts, cart_items, orders, order_items, addresses, wishlist, audit logs, notes.
- ON DELETE intent mostly consistent:
  - Cascade on user->addresses/wishlist/carts.
  - No-action on order->user/product references, preserving historical order data.
- Orphan risk: low where FK is enforced; moderate where nullable parent IDs are used by design.

### 3.3 Index Coverage
Requested fields:
- `createdAt`: indexed for `orders` (present).
- `status`: **missing dedicated index** on orders status.
- `active`: **missing dedicated index** on products active.
- `userId`: indexed on orders, addresses, carts, wishlist.
- `productId`: indexed on cart_items, order_items, wishlist.
- `orderId`: indexed on order_items.

### 3.4 Data Consistency Edge Cases (code-level simulation)
- Duplicate cart insertion race: mitigated by unique `(cartId, productId)` index, but API path does pre-check + insert/update and may still surface unique violation without graceful retry.
- Wishlist race: unique `(userId, productId)` index prevents duplicates; same graceful handling caveat.
- Concurrent stock decrement: conditional update and locks reduce oversell.
- Product soft-delete during checkout: checkout checks existence and stock, not active flag; soft-deleted but existing product may still pass depending on data state.

**Data Integrity Score: 7.5**  
**Concurrency Safety Score: 7.0**

---

## SECTION 4 – AUTHENTICATION & SESSION HARDENING

- JWT secret enforcement: hard-fail when `JWT_SECRET` missing.
- Expiry validation: handled by `jwt.verify`.
- `tokenVersion` enforcement: implemented in `requireAuth` against DB snapshot.
- Active-user enforcement: blocked when `active=false`.
- Role downgrade behavior: role is checked against DB snapshot each request; effective quickly on backend.
- Session revocation: tokenVersion bump invalidates old tokens.
- Replay attack modeling: bearer token replay remains possible until expiry/revocation (standard JWT limitation).
- Token tampering: rejected by signature verification.
- Missing Bearer header: 401.
- Expired token: 401.

**Auth Robustness Score: 8.1**  
**Privilege Persistence Risk: MEDIUM** (client-side role UI lag, token replay window).

---

## SECTION 5 – SECURITY SURFACE ANALYSIS

### 5.1 Upload Surface
- Extension whitelist: yes (`.jpg/.jpeg/.png/.webp`).
- MIME validation: yes (extension↔mimetype check).
- Magic-byte verification: yes (`readFileSync` signature check).
- Size limit: yes (10 MB per file).
- Path traversal: mitigated via fixed storage dir and basename-based URL mapping.
- Sync I/O risk: present (`fs.readFileSync`, `fs.unlinkSync`) in request path.
- Orphan cleanup: implemented on product delete for known upload-linked image paths.

### 5.2 API Attack Surface
- ID enumeration: mitigated on sensitive resources by ownership/admin checks; still possible to probe existence via response timing/status.
- Parameter injection: Zod guards on many routes; uneven coverage on some admin/manual-check endpoints.
- Validation bypass: moderate risk where endpoints use ad-hoc validation.
- Rate limiting coverage:
  - Global API limiter present.
  - Auth/checkout/contact route limiters present.
  - `adminLimiter` exists but is not clearly applied to admin routes.

### 5.3 CORS
- CORS configured without restrictive origin allowlist (default permissive).
- Credentials not explicitly enabled; reduces cookie leakage risk but policy is broad.

### 5.4 Error Leakage
- API error wrapper normalizes failures to `{ error }`.
- 500 handlers return generic messages in most routes.
- Server logs can include response snippets for API calls (operational caution).

**Security Posture Level: MODERATE**  
**Exploitability Risk Level: MEDIUM**

---

## SECTION 6 – PERFORMANCE & SCALE MODEL

- N+1 detection: several storage methods use joins/grouping properly; some admin aggregation loops perform repeated queries (`getOrdersByStatus` iterative counts).
- Heavy loop queries: timeseries/status summary methods may become costly at scale without materialized aggregates.
- Post-pagination filtering: mixed; many endpoints paginate in storage, some older endpoints fetch all (`getAllOrders`).
- Blocking I/O in request path: upload flow uses sync fs operations.
- Bundle size impact: production JS bundle ~1.3 MB with chunk-size warning.
- Memory pressure: large in-memory arrays for exports and some admin reports.
- Expected RPS capacity estimate: **Not verifiable in this environment** (no load test).

**Scalability Rating: MEDIUM**  
**Bottleneck Locations:** upload sync I/O path, admin all-orders/export flows, large frontend bundle.

---

## SECTION 7 – FAILURE MODE ANALYSIS

Simulated/assessed by code path:

1. DB connection drop
- Crash? Likely request failures; startup fails hard if DB unavailable at bootstrap depending on access pattern.
- Graceful failure? Partial; many endpoints return 500.
- Silent corruption? Low.
- Data inconsistency? Low/moderate if failure mid non-transactional flow.

2. Upload directory permission failure
- Crash? Startup tries mkdir/chmod; chmod errors are caught and logged, process continues.
- Graceful failure? Upload endpoint may fail with 500.
- Silent corruption? Low.

3. Disk full
- Crash? Unlikely full crash; upload failures probable.
- Graceful failure? Endpoint-level 500 likely.
- Silent corruption? Moderate risk of partial file artifacts.

4. Migration missing
- Crash? Runtime query failures possible.
- Graceful failure? 500 responses; no startup migration guard.
- Silent corruption? Medium (schema drift issues).

5. `JWT_SECRET` missing
- Crash? Auth operations fail immediately by design; startup may still run until token operation invoked.
- Graceful failure? Fail-fast behavior in token utility.

6. Concurrent high-load checkout
- Crash? Not expected.
- Graceful failure? 400 on stock conflicts.
- Silent corruption? Low for checkout transaction path.
- Data inconsistency? Reduced by transaction + locking, not formally load-tested.

**Failure Resilience Score: 6.8**

---

## SECTION 8 – DEPLOYMENT & CONFIGURATION VALIDATION

- Hardcoded localhost URLs:
  - Frontend API uses relative `/api` (good).
  - Server startup log prints localhost URL (non-functional concern).
- Dev-only configs in production:
  - Vite path only used when `NODE_ENV !== production` (good).
- Environment variable requirements documented:
  - Partially inferred in code; formal deployment README absent in this repo snapshot.
- Migrations bootstrap empty DB:
  - Migration files exist; no verified end-to-end bootstrap execution in this environment.
- Upload directory requirement documented:
  - Implemented in code; documentation quality limited.

**Deployment Safety Score: 6.9**

---

## SECTION 9 – CODE QUALITY & MAINTAINABILITY

- Monolithic files: `server/routes.js` and `client/src/pages/AdminPage.jsx` are large and multi-concern.
- Duplicate logic: multiple order endpoints overlap; mixed legacy/current patterns present.
- Repeated patterns: manual fetch/error handling duplicated in contexts/pages.
- Unused helpers/artifacts: orphan page file exists (`pages/not-found.jsx`), multiple historical report docs in root add noise.
- Naming consistency: generally acceptable; some mixed casing conventions (`PENDING` vs `pending`).
- Separation of concerns: moderate; route/controller/business logic often co-located.
- Domain boundaries: present but weakly enforced.

**Maintainability Score: 6.3**  
**Technical Debt Level: MEDIUM–HIGH**

---

## FINAL SECTION – ABSOLUTE CERTIFICATION

**Overall System Certification Score (0–100): 69**

### Explicit deployment answers
- **Safe for real client deployment?** **NO** (not yet; key robustness gaps remain).
- **Safe for medium traffic?** **NO** (possible with mitigation, but current bottlenecks and validation unevenness are unresolved).
- **Safe for high-scale traffic?** **NO**.
- **Any hidden critical risks remaining?** **YES**.
- **Any structural redesign required?** **YES** (backend route modularization, stricter validation standardization, performance hardening).

### Critical residual risks (evidence-based)
1. Frontend functional bug in wishlist add-to-cart argument contract.
2. Error-shape mismatch (`error` vs `message`) leading to degraded UX diagnostics.
3. Large monolithic route/page files increasing regression probability.
4. Missing indices on frequently filtered fields (`orders.status`, `products.active`) for scaling.
5. Upload path uses synchronous filesystem operations in request lifecycle.
6. Some mutation endpoints rely on manual validation rather than unified schemas.

