# Cash Flow Forecasting & Analytics Dashboard

An end-to-end financial analytics application that combines a **Python** data
science / forecasting engine, a **PostgreSQL + Prisma** data layer, and a modern
**Next.js (App Router) + TypeScript + Tailwind** executive dashboard.

It generates 24 months of realistic synthetic cash-flow history, forecasts the
next **90 days** of inflows, outflows and cash balance, and visualises the whole
picture — historical actuals blending into a dashed projection, month-over-month
inflow/outflow breakdown, runway & burn-rate widget, threshold/anomaly alerts,
and a recent-transactions table.

> **Live demo:** deploys to Vercel with a serverless Postgres (Neon). See
> [Deployment](#deployment-vercel--neon). Add your production URL here once live.

```
┌─────────────┐   writes/reads    ┌──────────────┐   Prisma (pg adapter)   ┌───────────────┐
│  Python      │ ───────────────▶ │  PostgreSQL   │ ◀────────────────────── │  Next.js app   │
│  analytics   │                  │  (Prisma      │                         │  (API + SSR    │
│  engine      │ ◀─────────────── │   schema)     │                         │   dashboard)   │
└─────────────┘   reads history   └──────────────┘                         └───────────────┘
```

## Tech stack

| Layer               | Technology                                             |
| ------------------- | ------------------------------------------------------ |
| Frontend / Backend  | Next.js 16 (App Router), TypeScript, Tailwind CSS v4   |
| Charts / Icons      | Recharts, Lucide                                       |
| Database / ORM      | PostgreSQL + Prisma 7 (with the `@prisma/adapter-pg` driver adapter) |
| Analytics engine    | Python 3 (NumPy, Pandas) — linear-regression trend + moving-average seasonal factors |

## Project structure

```
.
├── analytics/                  # Python forecasting engine
│   ├── venv/                   # virtual environment (git-ignored)
│   ├── db.py                   # DATABASE_URL loader + psycopg connection
│   ├── generate_mock_data.py   # seeds 24 months of synthetic transactions
│   ├── forecast.py             # 90-day forecast → forecasted_data table
│   └── requirements.txt
└── frontend/                   # Next.js application
    ├── prisma/
    │   ├── schema.prisma        # Transaction + ForecastedData models
    │   └── migrations/          # SQL migration (prisma migrate deploy)
    ├── lib/
    │   ├── prisma.ts            # PrismaClient singleton (pg adapter)
    │   ├── cashflow.ts          # data access + metrics/alerts computation
    │   ├── config.ts / types.ts / format.ts
    ├── app/
    │   ├── api/{metrics,cashflow,alerts}/route.ts
    │   └── page.tsx             # the dashboard
    └── components/              # cards, charts, banner, table
```

## Prerequisites

- **Node.js 18+** and **Python 3.10+** (developed on Node 24 / Python 3.14).
- **PostgreSQL 13+** — locally (developed on PostgreSQL 18, EnterpriseDB Windows
  installer) or a cloud instance such as [Neon](https://neon.tech) (see
  [Deployment](#deployment-vercel--neon)).

Dependencies are already installed by the initial setup. If you clone fresh:

```bash
cd frontend && npm install
cd ../analytics && python -m venv venv && ./venv/Scripts/python -m pip install -r requirements.txt
```

## Setup — one time

1. **Create the database** (using the password you set during install):

   ```bash
   createdb -U postgres cashflow
   # or in psql:  CREATE DATABASE cashflow;
   ```

2. **Point the app at it.** Copy the template and set your real password (this
   one file is the single source of truth — both Prisma and the Python engine
   read it, and it is git-ignored):

   ```bash
   cp frontend/.env.example frontend/.env
   ```

   ```
   # frontend/.env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cashflow?schema=public"
   ```

3. **Apply the schema:**

   ```bash
   cd frontend
   npx prisma migrate deploy      # creates the tables + enums
   npx prisma generate            # (already generated; run if you change schema)
   ```

4. **Seed data and run the forecast:**

   ```bash
   cd ../analytics
   ./venv/Scripts/python generate_mock_data.py   # 24 months of transactions
   ./venv/Scripts/python forecast.py             # 90-day forecast → DB
   ```

   > On macOS/Linux use `./venv/bin/python` instead of `./venv/Scripts/python`.

## Run the dashboard

```bash
cd frontend
npm run dev
# open http://localhost:3000
```

If the database isn't reachable or is empty, the dashboard shows a friendly
setup screen with these exact steps instead of crashing.

To refresh the forecast at any time (e.g. after new data), re-run
`forecast.py`; the dashboard reads the latest values on every request.

## Deployment (Vercel + Neon)

The Next.js app deploys to **Vercel**. Because a Vercel serverless function can't
reach a `localhost` database, production uses a **cloud PostgreSQL** — this
project uses a free [Neon](https://neon.tech) database. The exact same
`DATABASE_URL` mechanism drives both local and cloud: `analytics/db.py` preserves
`sslmode=require` (and any other DSN params) so the Python engine connects to
Neon too.

### 1. Create and seed a cloud database (once)

Create a Neon project, then run the migration + seed + forecast against it. Pass
the connection string inline so your local `.env` stays pointed at local Postgres:

```bash
# Use the DIRECT (non-pooled) Neon string for migrations/seeding
export NEON="postgresql://<user>:<pass>@<endpoint>.<region>.aws.neon.tech/neondb?sslmode=require"

cd frontend
DATABASE_URL="$NEON" npx prisma migrate deploy          # create tables + enums

cd ../analytics
DATABASE_URL="$NEON" ./venv/Scripts/python generate_mock_data.py
DATABASE_URL="$NEON" ./venv/Scripts/python forecast.py
```

### 2. Import the repo into Vercel

1. **Vercel → Add New… → Project** and import this GitHub repo.
2. Set **Root Directory** to `frontend` (the Next.js app lives there). Framework
   is auto-detected as Next.js; the build command is `prisma generate && next build`
   (defined in `frontend/package.json`, so the Prisma client is regenerated on
   every deploy).
3. Add an **Environment Variable** `DATABASE_URL` set to the Neon **pooled**
   connection string — the host contains `-pooler` — which is required for
   serverless connection pooling:

   ```
   postgresql://<user>:<pass>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   ```

4. **Deploy.** The dashboard is fully server-rendered on demand (`force-dynamic`),
   so it always reflects the latest data in Neon.

> **Secrets:** real connection strings live only in `.env` (git-ignored) and in
> Vercel's env vars. Only `frontend/.env.example` (a placeholder template) is
> committed.

## API endpoints

All return JSON and are always dynamic (never cached):

| Route            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `GET /api/metrics`  | Current cash, projected 90-day balance, avg monthly inflow/outflow, totals, monthly burn rate, runway. |
| `GET /api/cashflow` | Combined historical + 90-day forecast cash-position series, plus 12-month inflow/outflow breakdown. |
| `GET /api/alerts`   | Safety-threshold breaches, short-runway warnings and statistical daily-flow anomalies. |

## How the forecast works

`forecast.py` aggregates transactions into a dense daily series of inflows and
outflows, then forecasts each series 90 days ahead with an **additive** model:

```
forecast(t) = linear_trend(t)  +  day_of_month_factor  +  weekday_factor
```

- **Linear-regression trend** captures the underlying growth/decline level.
- **Day-of-month factors** (mean of the detrended residual by calendar day)
  capture recurring events — payroll on the 1st/15th, rent on the 3rd, etc.
- **Weekday factors** capture the weekly revenue rhythm (weekends are quiet).

The running cash-balance line is anchored so the last historical day equals the
current cash position (`CURRENT_CASH` in `forecast.py`) and projected forward,
so the actual and forecast lines join seamlessly on the chart. Values are cached
in the `forecasted_data` table for fast dashboard loads.

> **Tuning:** `CURRENT_CASH` / `HORIZON_DAYS` live in `analytics/forecast.py`;
> the `SAFETY_THRESHOLD` and runway-warning limit live in `frontend/lib/config.ts`.
