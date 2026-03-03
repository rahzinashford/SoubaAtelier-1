# Client Setup Guide

This guide provides a step-by-step process to deploy the application in a production-oriented environment.

## 1) Server Requirements
- Linux server (Ubuntu LTS recommended)
- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Nginx (recommended reverse proxy)
- Valid domain name and DNS access
- TLS certificate (Let’s Encrypt or managed certificate)

## 2) PostgreSQL Setup
1. Install and start PostgreSQL.
2. Create a dedicated database and user.
3. Grant least-privilege access to that user for the application database.
4. Record the connection string in this format:
   ```
   postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>
   ```

## 3) Environment Variable Setup
Create a `.env` file in the project root and set production values:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/souba_atelier
JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRES_IN=1d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
```

Recommendations:
- Use long, random secrets and strong passwords.
- Restrict `.env` file permissions to the deployment user.
- Never commit `.env` to source control.

## 4) Install Dependencies
From the project root:

```bash
npm install
```

## 5) Execute Database Migrations
Run schema migrations:

```bash
npm run db:migrate
```

If applicable, run seed data scripts:

```bash
npm run db:seed
```

## 6) Build for Production
Create the production build:

```bash
npm run build
```

## 7) Start the Application
Start the production process:

```bash
npm run start
```

For reliability in production, run the process with a manager such as PM2 or systemd.

## 8) Reverse Proxy Recommendation (Nginx)
Use Nginx in front of the Node.js process to:
- Terminate HTTPS
- Route traffic to the app server
- Apply request size/time limits
- Serve as a stable public entry point

Typical upstream target:
- `http://127.0.0.1:3000`

## 9) HTTPS Recommendation
- Enforce HTTPS for all public traffic.
- Redirect HTTP to HTTPS.
- Use modern TLS settings and auto-renew certificates.
- Confirm secure cookie/session settings in production behavior.

## 10) Admin Account Setup Note
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first startup.
- Store admin credentials securely (password manager or secret manager).
- Rotate credentials according to your security policy.

## 11) Basic Security Recommendations
- Restrict inbound ports to 80/443 (and SSH from trusted IPs only).
- Keep OS packages, Node.js, and PostgreSQL up to date.
- Use strong database passwords and dedicated DB users.
- Enable backups for PostgreSQL and test restores regularly.
- Monitor logs and set alerts for repeated failed authentication attempts.
