# Cash Flow Forecasting & Analytics Dashboard

An end-to-end financial analytics application that combines a **Python** data
science / forecasting engine, a **PostgreSQL + Prisma** data layer, and a modern
**Next.js (App Router) + TypeScript + Tailwind** executive dashboard.

It generates 24 months of realistic synthetic cash-flow history, forecasts the
next **90 days** of inflows, outflows and cash balance, and visualises the whole
picture — historical actuals blending into a dashed projection, month-over-month
inflow/outflow breakdown, runway & burn-rate widget, threshold/anomaly alerts,
and a recent-transactions table.

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
- **PostgreSQL 13+** running locally (e.g. the EnterpriseDB Windows installer).

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

2. **Point the app at it.** Edit `frontend/.env` and replace `CHANGE_ME` with
   your real Postgres password (this one file is the single source of truth —
   both Prisma and the Python engine read it):

   ```
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
