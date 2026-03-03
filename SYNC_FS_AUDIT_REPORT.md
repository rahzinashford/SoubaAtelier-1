# SYNC_FS_AUDIT_REPORT

## Synchronous Filesystem Call Inventory

| File | Line | Sync Call | Context | Risk Level | Proposed Fix |
|---|---:|---|---|---|---|
| `server/routes.js` | 19 | `fs.existsSync(uploadDir)` | Startup | LOW | Optional: replace with `await fs.promises.access(...)` in an async bootstrap helper. |
| `server/routes.js` | 20 | `fs.mkdirSync(uploadDir, ...)` | Startup | LOW | Optional: replace with `await fs.promises.mkdir(..., { recursive: true })`. |
| `server/routes.js` | 24 | `fs.chmodSync(uploadRootDir, ...)` | Startup | LOW | Optional: replace with `await fs.promises.chmod(...)`. |
| `server/routes.js` | 25 | `fs.chmodSync(uploadDir, ...)` | Startup | LOW | Optional: replace with `await fs.promises.chmod(...)`. |
| `server/static.js` | 7 | `fs.existsSync(distPath)` | Startup | LOW | Optional: replace with async `fs.promises.access(...)` during startup validation. |

## Implemented Fixes (requested scope)

- ✅ Request lifecycle sync calls: **fixed**.
- ✅ Cleanup path sync calls: **fixed**.

### Change made
- Replaced sync cleanup path in `DELETE /api/products/:id` from `existsSync + unlinkSync` to async `await fs.promises.unlink(...)` with `ENOENT` handling.

## Return

- **Remaining sync calls count:** **5**
- **Any sync in request path:** **NO**
