import { CURRENCY } from "@/lib/config";

/** Format a number as compact currency (e.g. $1.2M, $780K, $12.5K). */
export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format a number as full currency with no decimals (e.g. $780,000). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a YYYY-MM-DD string as a short, human date (e.g. "Jun 14, 2026"). */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Format a YYYY-MM-DD string as month + year only (e.g. "Jun 2026"). */
export function formatMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Runway label: months → "8.3 mo" or "∞" when cash-flow positive. */
export function formatRunway(months: number | null): string {
  if (months === null) return "∞";
  return `${months.toFixed(1)} mo`;
}
