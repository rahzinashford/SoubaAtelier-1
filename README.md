# Souba Atelier

## Project Overview
Souba Atelier is a full-stack web application built for reliable day-to-day operations and secure online transactions. The platform combines a modern React frontend with a Node.js/Express API and PostgreSQL database to deliver a fast, maintainable, and production-ready experience.

## Feature Summary
- Responsive web interface powered by React (Vite)
- REST API built with Node.js and Express
- PostgreSQL persistence with Drizzle ORM
- JWT-based authentication
- Role-based admin access controls
- Request rate limiting for API protection
- Zod-based request validation
- Transactional checkout workflow for data consistency

## Tech Stack
- **Frontend:** React, Vite
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** JWT
- **Validation:** Zod
- **Security Controls:** Rate limiting, role-based authorization

## Environment Requirements
- **Node.js:** 18.x or newer (LTS recommended)
- **npm:** 9.x or newer
- **PostgreSQL:** 14.x or newer

## Required Environment Variables
Create a `.env` file in the project root with values appropriate for your environment:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/souba_atelier
JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRES_IN=1d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
```

> Use unique and secure values in production, especially for `JWT_SECRET` and admin credentials.

## Installation Steps
1. Clone the repository.
2. Move into the project directory:
   ```bash
   cd SoubaAtelier-1
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Database Migration Steps
1. Confirm PostgreSQL is running and `DATABASE_URL` is correct.
2. Run migrations:
   ```bash
   npm run db:migrate
   ```
3. (Optional) Seed initial data if your project includes a seed script:
   ```bash
   npm run db:seed
   ```

## Development Mode
Start the development environment:

```bash
npm run dev
```

This typically runs the frontend and backend in development mode with hot reload.

## Production Build
Build and run for production:

```bash
npm run build
npm run start
```

If frontend and backend are started separately in your environment, use your project-specific production start commands after build.

## Security Overview
This application includes foundational security controls for production use:
- JWT authentication for protected endpoints
- Role-based authorization for admin actions
- Rate limiting to reduce abusive traffic
- Zod validation to enforce request shape and reduce invalid input
- Transactional checkout handling to preserve consistency during purchase workflows

## Additional Documentation
- Client setup guide: [CLIENT_SETUP.md](./CLIENT_SETUP.md)
- Pre-launch verification list: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
