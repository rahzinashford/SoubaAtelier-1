# DEPLOYMENT_CHECKLIST

## Pre-Deploy
- [ ] `npm ci` completes successfully
- [ ] `npm run build` completes successfully
- [ ] `DATABASE_URL` points to production database
- [ ] `JWT_SECRET` is set and rotated from any dev value
- [ ] `NODE_ENV=production`
- [ ] Rate limiting and security headers enabled

## Database
- [ ] Run migrations / schema sync process used by environment
- [ ] Validate connectivity and permissions
- [ ] Confirm backup/restore policy is active

## Runtime
- [ ] Application starts without crashes
- [ ] `/api/health` returns OK
- [ ] Static assets served correctly
- [ ] Upload directory is writable by runtime user

## Post-Deploy Verification
- [ ] Authentication login/register works
- [ ] Product listing and detail pages load
- [ ] Cart/checkout flow succeeds
- [ ] Admin routes protected and functioning
- [ ] Error responses are normalized and client-safe
