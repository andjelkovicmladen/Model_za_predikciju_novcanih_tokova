/**
 * Business/analytics constants shared across the dashboard.
 *
 * NOTE: `SAFETY_THRESHOLD` is the minimum operating cash below which the
 * business is considered at risk. The current-cash anchor itself lives in the
 * Python engine (`analytics/forecast.py::CURRENT_CASH`); the TypeScript side
 * derives it from the forecast so the historical and projected balance lines
 * always join seamlessly (see `deriveCurrentCash`).
 */
export const SAFETY_THRESHOLD = 500_000;

/** Forecast horizon in days — must match `analytics/forecast.py::HORIZON_DAYS`. */
export const HORIZON_DAYS = 90;

/** Runway shorter than this (months) escalates to a warning alert. */
export const RUNWAY_WARNING_MONTHS = 6;

/** Currency formatting used throughout the UI. */
export const CURRENCY = "USD";
