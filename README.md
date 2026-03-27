# Poshik

Poshik is a full-stack Next.js (App Router) application providing a pet-owner focused marketplace and services platform. It includes user authentication, KYC submission, appointment booking with doctors, events, a shop/cart/checkout flow, Stripe payments, file uploads, email verification, and admin dashboards.

This README documents how the project is organized, how to run it locally, and where to find important parts of the codebase.

## Table of contents

- [Key features](#key-features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Authentication & KYC](#authentication--kyc)
- [Payments (Stripe)](#payments-stripe)
- [Database & models](#database--models)
- [API reference (important routes)](#api-reference-important-routes)
- [Testing & linting](#testing--linting)
- [Deployment notes](#deployment-notes)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Key features

- Email/password authentication via NextAuth and credentials provider.
- Email verification and KYC submission flow for user verification.
- Role-based dashboard: `ADMIN`, `DOCTOR`, and `OWNER` areas under the app dashboard.
- Appointment booking between owners and doctors.
- Events (community) creation and listing.
- E-commerce features: product listing, cart management, order creation.
- Stripe integration for payments and webhook handling.
- Cloud file uploads (Cloudinary supported) and local `public/uploads` fallback.
- Email sending via SMTP/Nodemailer.

## Tech stack

- Next.js (App Router - server components)
- React + TypeScript
- Tailwind CSS
- MongoDB / Mongoose
- NextAuth for authentication
- Stripe for payments
- Nodemailer for transactional email

## Quick start

Prerequisites:

- Node.js (recommended v18+)
- npm (or pnpm / yarn)
- A running MongoDB instance (local or remote)

Steps:

```bash
git clone https://github.com/RUSSELLS-VIPER/poshik.git
cd poshik
npm install
cp .env.example .env
# Edit .env and provide real credentials (Mongo, SMTP, Stripe, Cloudinary, etc.)
npm run dev
```

Open http://localhost:3000 in your browser.

If you need a fresh dev environment that clears `.next`, use:

```bash
npm run dev:reset
```

## Environment variables

Copy `.env.example` to `.env` and fill the values:

- [.env.example](.env.example)

Example variables required (see `.env.example`):

```
MONGODB_URI=mongodb://localhost:27017/poshik
MONGODB_DB_NAME=poshik
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=inr
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

Notes:

- `NEXTAUTH_SECRET` is required for NextAuth JWT/session signing.
- `STRIPE_WEBHOOK_SECRET` is required if you enable webhook handlers in production.
- If you use Cloudinary for uploads, set the Cloudinary keys; otherwise file uploads may be stored under `public/uploads/`.

## Available scripts

- `npm run dev` — Run development server.
- `npm run dev:reset` — Clear `.next` and start dev server.
- `npm run build` — Build for production.
- `npm run start` — Start the production server after build.
- `npm run lint` — Run ESLint.

See `package.json` for the exact scripts and versions.

## Project structure (high level)

- [src/app](src/app) — Next.js routes and server components (app router).
- [src/components](src/components) — Reusable UI components grouped by feature.
- [src/lib](src/lib) — Utilities, services, database connection, auth helpers.
- [src/lib/db/models](src/lib/db/models) — Mongoose models (User, Product, Order, Appointment, etc.)
- [public/uploads](public/uploads) — Uploaded files (images/docs) when not using remote storage.
- next.config.js — Next.js configuration.
- tailwind.config.js — Tailwind CSS configuration.

Quick links to important files:

- Database connection: [src/lib/db/mongodb.ts](src/lib/db/mongodb.ts)
- NextAuth config: [src/lib/auth/auth.ts](src/lib/auth/auth.ts)
- Stripe helper: [src/lib/payments/stripe.ts](src/lib/payments/stripe.ts)
- Email helper: [src/lib/services/email.service.ts](src/lib/services/email.service.ts)
- KYC form component: [src/components/auth/KYCForm.tsx](src/components/auth/KYCForm.tsx)
- Login form: [src/components/auth/LoginForm.tsx](src/components/auth/LoginForm.tsx)

## Authentication & KYC

Authentication uses NextAuth with a credentials provider. The main NextAuth route is implemented at:

- [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts)

Email verification flows and KYC submission are implemented via dedicated API routes and helper services. The KYC front-end form lives at [src/components/auth/KYCForm.tsx](src/components/auth/KYCForm.tsx) and posts to `POST /api/auth/kyc`.

## Payments (Stripe)

Stripe integration helper is at [src/lib/payments/stripe.ts](src/lib/payments/stripe.ts). Checkout and webhook logic (if present) will expect `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to be set in your environment.

When testing webhooks locally, use the Stripe CLI (`stripe listen`) and forward events to your local server.

## Database & models

All Mongoose models are in [src/lib/db/models](src/lib/db/models). Key models include:

- `User` — user accounts, roles and verification flags
- `Pet` — pet profiles owned by owners
- `Appointment` — bookings between owners and doctors
- `Product`, `Cart`, `Order` — shop and checkout flow

The connection helper is [src/lib/db/mongodb.ts](src/lib/db/mongodb.ts).

## API reference (important routes)

This project exposes many API routes under `src/app/api`. A few important ones:

- Appointments: [src/app/api/appointments/route.ts](src/app/api/appointments/route.ts) — book and list appointments.
- Cart: [src/app/api/cart/route.ts](src/app/api/cart/route.ts) — add/get/clear cart.
- Events: [src/app/api/events/route.ts](src/app/api/events/route.ts) — list and create events (admin).
- Doctors: [src/app/api/doctors/route.ts](src/app/api/doctors/route.ts) — doctor listing & details.
- Products & Orders: routes under `src/app/api/products` and `src/app/api/orders` handle the marketplace flows.

Open those route files to see request/response shapes and permission checks (most handlers verify the session via NextAuth).

## Frontend overview

UI components are organized under [src/components]. Key pages live in `src/app` using the app-router layout groups:

- `(auth)/` — login, register and verification flows
- `(dashboard)/` — protected dashboards for admin/doctor/owner
- `discover/`, `profile/`, `api-docs/` — public/utility pages

## Testing & linting

- Run linter: `npm run lint`.

There are no automated tests included by default — consider adding unit/integration tests (Jest/Playwright) as a next step.

## Deployment notes

- This project is compatible with Vercel (recommended). Set environment variables in your Vercel project settings and deploy.
- If you deploy elsewhere, ensure you provide `NEXTAUTH_URL`, `MONGODB_URI`, and Stripe/SMTP credentials.

Production build:

```bash
npm run build
npm run start
```

## Contributing

- Fork the repo and open a pull request with a clear description of changes.
- Keep changes small and focused; add tests where appropriate.

## Troubleshooting

- "Missing MONGODB_URI" — verify `.env` and `MONGODB_URI` are set and reachable.
- Authentication errors — confirm `NEXTAUTH_SECRET` is set and matches the deployed environment.
- Stripe webhooks not received locally — use `stripe listen` and the correct `STRIPE_WEBHOOK_SECRET`.

If you want, I can also:

- Generate API documentation for every route and model.
- Add example Postman/Insomnia collection.
- Create a small seed script to pre-populate demo data.

---

If you'd like, I can now open a PR with these docs, add a CONTRIBUTING.md, or generate endpoint-level documentation.
