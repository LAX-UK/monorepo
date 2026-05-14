import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildCheckoutTotalsVm } from "@/lib/data/view-models/dashboard-checkout.vm";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";

type Props = { searchParams: Promise<{ lots?: string }> };

type BasketRow = {
  lot: Lot;
  hammer: number;
  premium: number;
  total: number;
  premiumPercentLabel: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MultiLotCheckoutPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/checkout",
  });
  const sp = await searchParams;
  const raw = (sp.lots ?? "").trim();
  const requestedIds = raw
    ? Array.from(
        new Set(
          raw
            .split(",")
            .map((s) => s.trim())
            .filter((id) => UUID_RE.test(id)),
        ),
      )
    : [];

  const rows: BasketRow[] = [];
  let unauthorisedCount = 0;
  if (requestedIds.length > 0) {
    const c = await getServerDataContainer();
    const results = await Promise.allSettled(requestedIds.map((id) => c.lots.getById(id)));
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const lot = result.value;
      if (lot.winnerId !== user.id) {
        unauthorisedCount += 1;
        continue;
      }
      const totals = buildCheckoutTotalsVm(
        lot.currentPrice,
        lot.buyerPremiumRate,
        lot.checkoutPricing,
      );
      rows.push({
        lot,
        hammer: totals.hammer,
        premium: totals.premium,
        total: totals.total,
        premiumPercentLabel: totals.premiumPercentLabel,
      });
    }
  }

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <DashboardPage className="space-y-6">
      <PageHeader
        title="Basket checkout"
        description="Review every lot in your basket. We currently process each lot through its own Xero invoice — basket-level invoicing is on the roadmap with finance."
        className="border-0 pb-0"
      />

      {requestedIds.length === 0 ? (
        <EmptyState
          title="Your basket is empty"
          description="Add lots to a basket by visiting your collection and selecting multiple settlements, or open each checkout directly."
          action={
            <Button variant="primary" asChild>
              <Link href="/dashboard/portfolio">Open collection</Link>
            </Button>
          }
        />
      ) : null}

      {requestedIds.length > 0 && rows.length === 0 ? (
        <Alert variant="destructive">
          <AlertTitle>No matching settlements</AlertTitle>
          <AlertDescription className="font-body text-sm">
            We couldn&apos;t find any winning lots for these ids. Check the URL or return to{" "}
            <Link href="/dashboard/portfolio" className="text-primary underline">
              your collection
            </Link>{" "}
            to refresh the basket.
          </AlertDescription>
        </Alert>
      ) : null}

      {unauthorisedCount > 0 ? (
        <Alert>
          <AlertTitle>Some lots were skipped</AlertTitle>
          <AlertDescription className="font-body text-sm">
            {unauthorisedCount} lot{unauthorisedCount === 1 ? "" : "s"} in the URL are not assigned
            to you as the winning bidder. They are not shown below.
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <Card className="border-outline-variant/15 bg-surface-container-lowest/80 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShoppingBag className="size-5 text-primary" aria-hidden />
                <h2 className="font-headline text-lg font-semibold text-on-surface">
                  {rows.length} lot{rows.length === 1 ? "" : "s"} ready for settlement
                </h2>
              </div>
              <div className="text-right">
                <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
                  Combined total
                </p>
                <p className="font-headline text-2xl tabular-nums text-primary">
                  {formatMoney(grandTotal.toFixed(2))}
                </p>
              </div>
            </header>
            <ul className="divide-y divide-outline-variant/15">
              {rows.map((row) => (
                <li key={row.lot.id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={lotPath(row.lot)}
                      className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {row.lot.title}
                    </Link>
                    <p className="text-xs text-on-surface-variant">
                      Hammer {formatMoney(row.hammer.toFixed(2))} · Premium{" "}
                      {row.premiumPercentLabel} ({formatMoney(row.premium.toFixed(2))})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
                      Lot total
                    </p>
                    <p className="font-headline text-base tabular-nums text-on-surface">
                      {formatMoney(row.total.toFixed(2))}
                    </p>
                  </div>
                  <Button variant="secondary" asChild>
                    <Link
                      href={`/dashboard/checkout/${row.lot.id}`}
                      className="inline-flex items-center gap-2"
                    >
                      Pay this lot <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="font-body text-xs text-on-surface-variant">
              We invoice and settle each lot individually for now. When finance enables basket
              invoicing, payment will consolidate into a single Xero invoice from this screen.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </DashboardPage>
  );
}
