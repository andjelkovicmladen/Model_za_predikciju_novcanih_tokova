"""Populate the database with 24 months of synthetic cash-flow transactions.

The generated data is deliberately *realistic*:

* Revenue (INFLOW) follows a gently growing trend, a yearly seasonal curve
  (strong Q4, soft summer), a weekday pattern (little revenue on weekends) and
  random noise. It arrives as many individual customer invoices.
* Recurring OUTFLOWs mirror how a real SaaS-style company spends money:
  semi-monthly payroll, monthly rent/ops, monthly software subscriptions,
  variable monthly marketing and quarterly tax payments.

Expenses are tuned to run *slightly ahead* of revenue on average so the
dashboard has a meaningful burn rate, runway and a threshold-breach alert to
show off — while seasonality keeps some months cash-positive.

Run:  python analytics/generate_mock_data.py
"""

from __future__ import annotations

import random
import uuid
from datetime import date

from db import connect

RNG_SEED = 42
MONTHS_OF_HISTORY = 24

# --- Economic assumptions (whole currency units) --------------------------------
BASE_MONTHLY_REVENUE = 480_000.0      # average monthly revenue at the midpoint
ANNUAL_GROWTH = 0.18                  # ~18% YoY top-line growth
MONTHLY_PAYROLL = 352_000.0          # total staff cost / month (split semi-monthly)
MONTHLY_RENT_OPS = 46_000.0          # office, utilities, general operating
MONTHLY_SOFTWARE = 18_500.0          # SaaS tooling & infrastructure
MONTHLY_MARKETING_BASE = 94_000.0    # marketing spend, varies month to month
QUARTERLY_TAX = 90_000.0             # estimated tax payment every 3 months

# Yearly seasonality multiplier by calendar month (Jan..Dec). >1 boosts revenue.
SEASONALITY = [
    0.86,  # Jan (post-holiday slump)
    0.90,  # Feb
    1.02,  # Mar (quarter close)
    0.98,  # Apr
    1.00,  # May
    0.94,  # Jun (early summer)
    0.88,  # Jul (summer soft)
    0.90,  # Aug
    1.06,  # Sep (back to business)
    1.10,  # Oct
    1.18,  # Nov (holiday build-up)
    1.24,  # Dec (peak)
]

REVENUE_DESCRIPTIONS = [
    "Invoice — Enterprise plan", "Invoice — Team plan", "Invoice — Pro plan",
    "Invoice — Annual contract", "Invoice — Usage overage", "Invoice — Onboarding",
    "Invoice — Add-on seats", "Invoice — Professional services",
]


def month_index_to_date(start: date, month_offset: int) -> date:
    """Return the first day of the month ``month_offset`` months after ``start``."""
    y = start.year + (start.month - 1 + month_offset) // 12
    m = (start.month - 1 + month_offset) % 12 + 1
    return date(y, m, 1)


def days_in_month(d: date) -> int:
    nxt = month_index_to_date(d, 1)
    return (nxt - d.replace(day=1)).days


def build_transactions() -> list[tuple]:
    """Return a list of ``(date, description, category, type, amount)`` rows."""
    rng = random.Random(RNG_SEED)
    rows: list[tuple] = []

    today = date.today()
    # Start on the 1st, 24 months ago.
    first_month = month_index_to_date(today.replace(day=1), -MONTHS_OF_HISTORY)

    for m in range(MONTHS_OF_HISTORY):
        month_start = month_index_to_date(first_month, m)
        n_days = days_in_month(month_start)

        # Growth: interpolate around the midpoint of the window.
        growth = (1.0 + ANNUAL_GROWTH) ** ((m - MONTHS_OF_HISTORY / 2) / 12.0)
        season = SEASONALITY[month_start.month - 1]
        target_revenue = BASE_MONTHLY_REVENUE * growth * season

        # ---- Revenue: spread across ~18-26 invoices, weekday-weighted ----------
        n_invoices = rng.randint(18, 26)
        weights = []
        invoice_days = []
        for _ in range(n_invoices):
            day = rng.randint(1, n_days)
            d = month_start.replace(day=day)
            # Weekends see far fewer deals closing.
            w = 0.15 if d.weekday() >= 5 else 1.0
            weights.append(w * rng.uniform(0.6, 1.4))
            invoice_days.append(d)
        wsum = sum(weights) or 1.0
        for d, w in zip(invoice_days, weights):
            amt = target_revenue * (w / wsum)
            amt = max(500.0, amt * rng.uniform(0.9, 1.1))
            rows.append((d, rng.choice(REVENUE_DESCRIPTIONS), "REVENUE", "INFLOW", round(amt, 2)))

        # ---- Payroll: semi-monthly on the 1st and 15th -------------------------
        half = MONTHLY_PAYROLL / 2.0 * growth  # payroll grows with headcount
        for pay_day in (1, 15):
            d = month_start.replace(day=min(pay_day, n_days))
            amt = half * rng.uniform(0.99, 1.01)
            rows.append((d, "Payroll run", "PAYROLL", "OUTFLOW", round(amt, 2)))

        # ---- Rent & operating: monthly on the 3rd ------------------------------
        d = month_start.replace(day=min(3, n_days))
        amt = MONTHLY_RENT_OPS * rng.uniform(0.97, 1.05)
        rows.append((d, "Office rent & operating costs", "OPERATING_EXPENSES", "OUTFLOW", round(amt, 2)))

        # ---- Software subscriptions: monthly on the 5th ------------------------
        d = month_start.replace(day=min(5, n_days))
        amt = MONTHLY_SOFTWARE * rng.uniform(0.95, 1.08)
        rows.append((d, "SaaS & cloud infrastructure", "SOFTWARE", "OUTFLOW", round(amt, 2)))

        # ---- Marketing: monthly, ramps with growth, high variance -------------
        d = month_start.replace(day=min(rng.randint(8, 20), n_days))
        amt = MONTHLY_MARKETING_BASE * growth * rng.uniform(0.7, 1.35)
        rows.append((d, "Marketing & advertising", "MARKETING", "OUTFLOW", round(amt, 2)))

        # ---- Taxes: quarterly (months whose index is a multiple of 3) ---------
        if month_start.month in (3, 6, 9, 12):
            d = month_start.replace(day=min(20, n_days))
            amt = QUARTERLY_TAX * growth * rng.uniform(0.95, 1.1)
            rows.append((d, "Quarterly estimated tax", "TAXES", "OUTFLOW", round(amt, 2)))

    rows.sort(key=lambda r: r[0])
    return rows


def main() -> None:
    rows = build_transactions()
    print(f"Generated {len(rows)} synthetic transactions.")

    conn = connect()
    try:
        with conn.cursor() as cur:
            # Fresh dataset every run.
            cur.execute('TRUNCATE TABLE "transactions"')
            cur.executemany(
                '''
                INSERT INTO "transactions" (id, date, description, category, type, amount, "createdAt")
                VALUES (%s, %s, %s, %s::"Category", %s::"FlowType", %s, now())
                ''',
                [(str(uuid.uuid4()), *row) for row in rows],
            )
        conn.commit()

        with conn.cursor() as cur:
            cur.execute(
                'SELECT type, count(*), sum(amount) FROM "transactions" GROUP BY type ORDER BY type'
            )
            print("Inserted summary:")
            for flow_type, count, total in cur.fetchall():
                print(f"  {flow_type:<8} {count:>4} rows  total={float(total):>14,.2f}")
    finally:
        conn.close()

    print("Done. Database seeded with 24 months of cash-flow history.")


if __name__ == "__main__":
    main()
