import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { TransactionDTO, TxCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<TxCategory, string> = {
  REVENUE: "Revenue",
  PAYROLL: "Payroll",
  OPERATING_EXPENSES: "Operating",
  SOFTWARE: "Software",
  TAXES: "Taxes",
  MARKETING: "Marketing",
  OTHER: "Other",
};

const CATEGORY_STYLE: Record<TxCategory, string> = {
  REVENUE: "bg-inflow/10 text-inflow",
  PAYROLL: "bg-outflow/10 text-outflow",
  OPERATING_EXPENSES: "bg-amber-400/10 text-amber-300",
  SOFTWARE: "bg-forecast/10 text-forecast",
  TAXES: "bg-purple-400/10 text-purple-300",
  MARKETING: "bg-pink-400/10 text-pink-300",
  OTHER: "bg-slate-400/10 text-slate-300",
};

export function TransactionsTable({ transactions }: { transactions: TransactionDTO[] }) {
  return (
    <Card className="flex h-full flex-col pb-2">
      <CardHeader title="Recent Transactions" subtitle="Latest cash-flow activity" />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Description</th>
              <th className="px-5 py-2 font-medium">Category</th>
              <th className="px-5 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const inflow = t.type === "INFLOW";
              return (
                <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                  <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted">
                    {formatShortDate(t.date)}
                  </td>
                  <td className="px-5 py-2.5 text-foreground">{t.description}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium",
                        CATEGORY_STYLE[t.category],
                      )}
                    >
                      {CATEGORY_LABEL[t.category]}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-5 py-2.5 text-right font-medium tabular",
                      inflow ? "text-inflow" : "text-outflow",
                    )}
                  >
                    {inflow ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
