# CLIENT_SETUP

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL database

## Environment
Create a `.env` file with required values:

- `DATABASE_URL=<postgres-connection-string>`
- `JWT_SECRET=<strong-random-secret>`
- `PORT=5000` (optional)
- `NODE_ENV=development` (for local development)

## Install & Run
```bash
npm install
npm run dev
```

App runs on `http://localhost:5000`.

## Build & Start (Production Mode)
```bash
npm run build
npm start
```
