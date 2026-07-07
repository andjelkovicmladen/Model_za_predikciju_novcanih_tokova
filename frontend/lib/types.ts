/**
 * Shared, strict types for the cash-flow dashboard. These are framework- and
 * ORM-agnostic (plain string unions rather than Prisma enums) so they can be
 * imported freely by both server code and client ("use client") components
 * without pulling the Prisma runtime into the browser bundle.
 */

export type FlowDirection = "INFLOW" | "OUTFLOW";

export type TxCategory =
  | "REVENUE"
  | "PAYROLL"
  | "OPERATING_EXPENSES"
  | "SOFTWARE"
  | "TAXES"
  | "MARKETING"
  | "OTHER";

/** A single transaction as surfaced to the UI (amounts as plain numbers). */
export interface TransactionDTO {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: TxCategory;
  type: FlowDirection;
  amount: number;
}

/** Headline metrics for the summary cards + runway widget. */
export interface Metrics {
  currentCash: number;
  projected90DayBalance: number;
  totalInflow: number;
  totalOutflow: number;
  avgMonthlyInflow: number;
  avgMonthlyOutflow: number;
  /**
   * Net monthly burn based on the most recent quarter. Positive = burning cash,
   * negative = cash-flow positive (accumulating).
   */
  monthlyBurnRate: number;
  /** Months of runway at the current burn rate; null when cash-flow positive. */
  runwayMonths: number | null;
  safetyThreshold: number;
  months: number; // number of historical months represented
}

/**
 * One point on the main cash-position chart. Historical and forecast values are
 * kept in separate keys (with nulls elsewhere) so the chart can render a solid
 * historical area that blends into a dashed forecast line. The two series share
 * the join date, where both keys hold `currentCash`.
 */
export interface CashPositionPoint {
  date: string; // YYYY-MM-DD
  historicalBalance: number | null;
  forecastBalance: number | null;
}

/** Inflow vs outflow for a single month (month-over-month bar chart). */
export interface MonthlyBreakdownPoint {
  month: string; // YYYY-MM
  label: string; // e.g. "Nov '25"
  inflow: number;
  outflow: number;
  net: number;
}

export type AlertLevel = "critical" | "warning" | "info";

/** A dashboard alert / anomaly notice. */
export interface CashAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  /** Days from today, when the alert refers to a future forecast event. */
  day?: number;
  date?: string;
}

/** Response shape of GET /api/cashflow. */
export interface CashflowResponse {
  cashPosition: CashPositionPoint[];
  monthlyBreakdown: MonthlyBreakdownPoint[];
  lastHistoricalDate: string;
  forecastModel: string | null;
}
