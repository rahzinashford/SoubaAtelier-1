# Wishlist Add-to-Cart Contract Fix Report

## Task Summary
Fixed the wishlist add-to-cart contract mismatch by aligning wishlist usage with `CartContext.addItem(product, quantity)` and adding defensive validation in `addItem`.

## Root Cause
- `CartContext.addItem` consumes a **product object** and reads `product.id` internally.
- Wishlist tab handler in `ProfilePage` passed only `product.id`, which broke the contract.

## Before vs After

### 1) Wishlist Add to Cart handler (Profile page)

**Before**
```jsx
onAddToCart={async (product) => {
  try {
    await addItem(product.id, 1);
    success('Added to cart');
  } catch (err) {
    error('Failed to add to cart');
  }
}}
```

**After**
```jsx
onAddToCart={async (product) => {
  try {
    await addItem(product, 1);
    success('Added to cart');
  } catch (err) {
    error('Failed to add to cart');
  }
}}
```

### 2) CartContext `addItem` defensive contract check

**Before**
```jsx
const addItem = useCallback(async (product, quantity = 1) => {
  if (!isAuthenticated) {
    setError('Please login to add items to cart');
    return false;
  }
  // ...
  body: JSON.stringify({
    productId: product.id,
    quantity,
  }),
```

**After**
```jsx
const addItem = useCallback(async (product, quantity = 1) => {
  if (!product || !product.id) {
    throw new Error('Invalid product passed to addItem');
  }

  if (!isAuthenticated) {
    setError('Please login to add items to cart');
    return false;
  }
  // ...
  body: JSON.stringify({
    productId: product.id,
    quantity,
  }),
```

## Contract Validation Outcome
- ✅ Contract mismatch is eliminated:
  - Wishlist now passes a full product object to `addItem`.
  - `addItem` now explicitly validates the input object and throws a descriptive error for malformed input.
  - Invalid calls can no longer silently proceed with `undefined` product IDs.

## Repository-Wide Call Audit
Searched all `addItem(` calls and verified there are no remaining `addItem(product.id, ...)` usages in `client/src`.

Current usages:
- `addItem(product, quantity)` in Product Detail page
- `addItem(p, 1)` in Product Detail related action
- `addItem(product, 1)` in Shop page
- `addItem(product, 1)` in Profile wishlist tab

## Build & Flow Confirmation
- ✅ Build passes successfully (`npm run build`).
- ✅ Wishlist → Add to Cart → Checkout contract path is now consistent end-to-end at the call boundary (`wishlist handler -> cart context -> API payload`).
