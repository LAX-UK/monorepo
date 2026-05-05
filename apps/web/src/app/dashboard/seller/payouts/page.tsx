import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

/** Stable read-model shape for seller-facing payouts (finance backend may stub). */
export type SellerPayoutRow = {
  id: string;
  lotTitle: string;
  hammer: string;
  fees: string;
  adjustments: string;
  net: string;
  status: "scheduled" | "processing" | "paid";
  expectedDate: string | null;
  statementUrl: string | null;
};

export default function SellerPayoutsPage() {
  const rows: SellerPayoutRow[] = [];

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Sold & payouts"
        description="Hammer prices, buyer premiums collected by LAX, seller commissions, and adjustments roll into each settlement batch."
        className="border-0 pb-0"
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No payouts to display yet"
          description="When hammer lots close in your favour, statements will appear here with downloadable PDF summaries. Finance hooks land alongside accountant tooling."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="p-4 font-body text-sm">{row.lotTitle}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
