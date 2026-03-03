# Deployment Checklist

Use this checklist before go-live to validate infrastructure, security, and application readiness.

## Infrastructure Checks
- [ ] Production server is provisioned and hardened.
- [ ] Node.js and npm versions meet application requirements.
- [ ] PostgreSQL is installed, reachable, and healthy.
- [ ] DNS records point to the correct production host.
- [ ] Nginx reverse proxy is configured and active.
- [ ] Backup and restore strategy is configured and tested.

## Application Checks
- [ ] Repository is deployed at the approved release version.
- [ ] Environment variables are set with production-safe values.
- [ ] Dependencies are installed successfully.
- [ ] Database migrations completed without errors.
- [ ] Production build completed successfully.
- [ ] Application process starts cleanly and restarts automatically.

## Security Checks
- [ ] HTTPS is enabled and HTTP redirects to HTTPS.
- [ ] JWT secret is strong and stored securely.
- [ ] Admin credentials are strong and stored securely.
- [ ] Rate limiting is enabled for API endpoints.
- [ ] Role-based admin access behaves as expected.
- [ ] Database user permissions follow least privilege.

## Functional Testing Checks
- [ ] User registration/login flow is working.
- [ ] JWT-protected endpoints require valid authentication.
- [ ] Admin-only routes are inaccessible to non-admin users.
- [ ] Input validation returns clear errors for invalid payloads.
- [ ] Checkout flow completes successfully and data remains consistent.
- [ ] Core user journeys are validated on desktop and mobile.

## Final Validation Checks
- [ ] Logs show no critical startup/runtime errors.
- [ ] Performance is acceptable under expected traffic.
- [ ] Monitoring and alerting are enabled.
- [ ] Documentation is delivered to operations/support teams.
- [ ] Stakeholder sign-off is complete for production release.
