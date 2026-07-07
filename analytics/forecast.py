"""Time-series forecasting engine for the cash-flow dashboard.

Pipeline
--------
1. Pull all historical transactions from PostgreSQL.
2. Aggregate to a dense *daily* series of INFLOW and OUTFLOW totals.
3. Forecast the next ``HORIZON_DAYS`` days for each series with an additive
   model:  linear-regression trend  +  day-of-month seasonal factors
   +  weekday seasonal factors  (a moving-average style decomposition).
   Day-of-month factors are what capture recurring events like payroll on the
   1st/15th, rent on the 3rd, software on the 5th, etc.
4. Reconstruct a running cash-balance line so that the balance on the final
   historical day equals ``CURRENT_CASH``, then project it forward.
5. Upsert the forecast into the ``forecasted_data`` table and print a JSON
   summary to stdout.

Run:  python analytics/forecast.py
"""

from __future__ import annotations

import json
import uuid
from datetime import timedelta

import numpy as np
import pandas as pd

from db import connect

HORIZON_DAYS = 90
MODEL_NAME = "linreg-trend+dom+weekday"

# Today's cash position (bank balance as of the most recent historical day).
# The historical balance line is reconstructed backwards from this anchor so it
# ends exactly here, and the forecast is projected forward from it.
CURRENT_CASH = 720_000.0


# --------------------------------------------------------------------------- #
# Data loading
# --------------------------------------------------------------------------- #
def load_daily_series(conn) -> pd.DataFrame:
    """Return a daily-indexed frame with columns ``inflow`` and ``outflow``."""
    with conn.cursor() as cur:
        cur.execute(
            '''
            SELECT date,
                   SUM(CASE WHEN type = 'INFLOW'  THEN amount ELSE 0 END) AS inflow,
                   SUM(CASE WHEN type = 'OUTFLOW' THEN amount ELSE 0 END) AS outflow
            FROM "transactions"
            GROUP BY date
            ORDER BY date
            '''
        )
        records = cur.fetchall()
    if not records:
        raise RuntimeError(
            "No transactions found. Run generate_mock_data.py first."
        )

    df = pd.DataFrame(records, columns=["date", "inflow", "outflow"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    # Densify: every calendar day between first and last, missing days -> 0.
    full = pd.date_range(df.index.min(), df.index.max(), freq="D")
    df = df.reindex(full, fill_value=0.0)
    df.index.name = "date"
    return df.astype(float)


# --------------------------------------------------------------------------- #
# Forecasting model
# --------------------------------------------------------------------------- #
def _seasonal_factor(residual: np.ndarray, keys: np.ndarray) -> dict[int, float]:
    """Mean residual grouped by an integer key (weekday or day-of-month)."""
    factors: dict[int, float] = {}
    for k in np.unique(keys):
        factors[int(k)] = float(residual[keys == k].mean())
    return factors


def forecast_series(values: np.ndarray, index: pd.DatetimeIndex,
                    future_index: pd.DatetimeIndex) -> np.ndarray:
    """Additive forecast: linear trend + day-of-month + weekday factors."""
    n = len(values)
    t = np.arange(n, dtype=float)

    # 1) Linear-regression trend over time (degree-1 least squares).
    slope, intercept = np.polyfit(t, values, 1)
    trend = slope * t + intercept

    # 2) Day-of-month seasonal factors on the detrended residual.
    dom = index.day.to_numpy()
    resid = values - trend
    dom_factor = _seasonal_factor(resid, dom)

    # 3) Weekday factors on what's left after removing the day-of-month effect.
    resid2 = resid - np.array([dom_factor[int(d)] for d in dom])
    wd = index.weekday.to_numpy()
    wd_factor = _seasonal_factor(resid2, wd)

    # 4) Project forward.
    future_t = np.arange(n, n + len(future_index), dtype=float)
    future_trend = slope * future_t + intercept
    f_dom = future_index.day.to_numpy()
    f_wd = future_index.weekday.to_numpy()

    overall_dom = float(np.mean(list(dom_factor.values())))
    overall_wd = float(np.mean(list(wd_factor.values())))

    forecast = np.empty(len(future_index), dtype=float)
    for i in range(len(future_index)):
        forecast[i] = (
            future_trend[i]
            + dom_factor.get(int(f_dom[i]), overall_dom)
            + wd_factor.get(int(f_wd[i]), overall_wd)
        )
    # Cash flows can't be negative.
    return np.clip(forecast, 0.0, None)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def run() -> dict:
    conn = connect()
    try:
        daily = load_daily_series(conn)

        inflow = daily["inflow"].to_numpy()
        outflow = daily["outflow"].to_numpy()
        hist_index = daily.index

        last_day = hist_index[-1].date()
        future_index = pd.date_range(
            last_day + timedelta(days=1), periods=HORIZON_DAYS, freq="D"
        )

        f_inflow = forecast_series(inflow, hist_index, future_index)
        f_outflow = forecast_series(outflow, hist_index, future_index)

        # Running balance: anchored so the last historical day == CURRENT_CASH.
        hist_net = inflow - outflow
        hist_cum = np.cumsum(hist_net)
        opening = CURRENT_CASH - hist_cum[-1]  # implied balance before day 1
        # Forecast balance projected forward from CURRENT_CASH.
        f_net = f_inflow - f_outflow
        f_balance = CURRENT_CASH + np.cumsum(f_net)

        rows = [
            (
                d.date(),
                round(float(fi), 2),
                round(float(fo), 2),
                round(float(fb), 2),
            )
            for d, fi, fo, fb in zip(future_index, f_inflow, f_outflow, f_balance)
        ]

        _write_forecast(conn, rows)

        summary = {
            "model": MODEL_NAME,
            "horizonDays": HORIZON_DAYS,
            "historyDays": len(hist_index),
            "lastHistoricalDate": last_day.isoformat(),
            "currentCash": round(CURRENT_CASH, 2),
            "impliedOpeningBalance": round(float(opening), 2),
            "projectedBalanceEnd": round(float(f_balance[-1]), 2),
            "avgDailyForecastInflow": round(float(f_inflow.mean()), 2),
            "avgDailyForecastOutflow": round(float(f_outflow.mean()), 2),
            "avgDailyForecastNet": round(float(f_net.mean()), 2),
        }
        return summary
    finally:
        conn.close()


def _write_forecast(conn, rows: list[tuple]) -> None:
    """Replace the cached forecast with freshly computed rows."""
    with conn.cursor() as cur:
        cur.execute('TRUNCATE TABLE "forecasted_data"')
        cur.executemany(
            '''
            INSERT INTO "forecasted_data"
                (id, date, "predictedInflow", "predictedOutflow",
                 "predictedBalance", model, "generatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, now())
            ''',
            [(str(uuid.uuid4()), d, fi, fo, fb, MODEL_NAME) for (d, fi, fo, fb) in rows],
        )
    conn.commit()


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
    print(f"\nWrote {result['horizonDays']}-day forecast to forecasted_data.")
