import { getCashflow } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

/** GET /api/cashflow — combined historical + 90-day forecast series for charts. */
export async function GET() {
  try {
    const data = await getCashflow();
    return Response.json(data);
  } catch (err) {
    console.error("[/api/cashflow]", err);
    return Response.json(
      { error: "Failed to load cash-flow series. Is the database seeded and reachable?" },
      { status: 500 },
    );
  }
}
