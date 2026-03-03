# Error Envelope Normalization Report

## Scope
Standardized frontend API error handling so backend error envelopes like `{ "error": "..." }` are consumed consistently.

## What Changed

### 1) Unified error parsing utilities
Added `client/src/lib/apiError.js`:
- `getErrorMessage(payload, fallback)`
  - Prefers `payload.error`
  - Falls back to `payload.message`
  - Falls back to provided default (or `"Request failed"`)
- `parseJsonSafely(response)`
  - Reads response body safely
  - Returns parsed JSON or `null`

### 2) Updated `fetchAPI` / `fetchAPIAuth`
`fetchAPI` now:
- Parses JSON once (`parseJsonSafely`)
- On non-OK response throws `new Error(getErrorMessage(data))`
- Returns parsed payload unchanged on success

`fetchAPIAuth` behavior is unchanged for auth guard (`Authentication required`) and delegates to normalized `fetchAPI`.

### 3) Removed non-normalized backend parsing in direct-fetch contexts
Updated direct API fetch paths in:
- `AuthContext` (`/auth/me`, `/auth/login`, `/auth/register`)
- `CartContext` (`/cart`, `/cart/item/:id` update/delete, `/cart` add)

All these now use the same `parseJsonSafely + getErrorMessage` normalization strategy.

## Before vs After (API helper)

### Before
```js
async function fetchAPI(endpoint, options) {
  // ...
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}
```

### After
```js
async function fetchAPI(endpoint, options) {
  // ...
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data;
}
```

## Contract Confirmation
- ✅ Error parsing is unified across shared API helpers and direct context-level API calls.
- ✅ Backend `{ error: string }` is now surfaced first everywhere normalization is used.
- ✅ `{ message: string }` remains supported as fallback.
- ✅ Generic fallback (`"Request failed"` or context-specific fallback) is used only when neither field exists.
- ✅ No double-wrapping introduced (no catch/rethrow chains that wrap normalized errors into new generic messages).
- ✅ Success payload parsing remains intact (single parse path, returned as-is).

## Build Confirmation
- ✅ `npm run build` passes.
