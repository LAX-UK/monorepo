import { DashboardPage } from "@/components/dashboard/dashboard-page";
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardSection,
} from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { CheckoutBasketPanel } from "@/components/sections/checkout/checkout-basket-panel";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildCheckoutTotalsVm } from "@/lib/data/view-models/dashboard-checkout.vm";
import { formatMoney } from "@/lib/format-currency";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Gavel, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ lots?: string; notice?: string }> };

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
  const hadRawButNoValidUuids = raw.length > 0 && requestedIds.length === 0;

  const rows: BasketRow[] = [];
  let unauthorisedCount = 0;
  let skippedPricingCount = 0;
  let fetchFailureCount = 0;
  if (requestedIds.length > 0) {
    const c = await getServerDataContainer();
    const results = await Promise.allSettled(requestedIds.map((id) => c.buyerLots.getById(id)));
    for (const result of results) {
      if (result.status === "rejected") {
        fetchFailureCount += 1;
        continue;
      }
      if (!result.value) continue;
      const lot = result.value;
      if (lot.winnerId !== user.id) {
        unauthorisedCount += 1;
        continue;
      }
      if (!lot.checkoutPricing) {
        skippedPricingCount += 1;
        continue;
      }
      const totals = buildCheckoutTotalsVm(lot.checkoutPricing);
      rows.push({
        lot,
        hammer: totals.hammer,
        premium: totals.premium,
        total: totals.total,
        premiumPercentLabel: totals.premiumPercentLabel,
      });
    }
  }

  const canonicalSorted = [...rows.map((r) => r.lot.id)].sort((a, b) => a.localeCompare(b));
  const requestedSorted = [...requestedIds].sort((a, b) => a.localeCompare(b));
  const urlMatchesCanonical =
    canonicalSorted.length === requestedSorted.length &&
    canonicalSorted.every((id, i) => id === requestedSorted[i]);

  if (requestedIds.length > 0 && rows.length > 0 && !urlMatchesCanonical) {
    redirect(`/dashboard/checkout?lots=${canonicalSorted.join(",")}`);
  }
  const shouldRedirectToCleanCheckout =
    requestedIds.length > 0 &&
    rows.length === 0 &&
    skippedPricingCount === 0 &&
    fetchFailureCount === 0;
  if (shouldRedirectToCleanCheckout) {
    redirect("/dashboard/checkout?notice=not-winner");
  }

  const notice = (sp.notice ?? "").trim();

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage className="space-y-6">
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Basket checkout"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Review every lot in your basket. We currently process each lot through its own Xero invoice — basket-level invoicing is on the roadmap with finance."
      />

      {requestedIds.length === 0 && !hadRawButNoValidUuids ? (
        <DashboardEmptyState
          variant="hero"
          icon={<Gavel aria-hidden />}
          title="Your basket is empty"
          description="Add lots to a basket by visiting your collection and selecting multiple settlements, or open each checkout directly."
          action={
            <Button variant="primary" asChild>
              <Link href="/dashboard/portfolio">Open collection</Link>
            </Button>
          }
        />
      ) : null}

      {hadRawButNoValidUuids ? (
        <DashboardErrorAlert
          title="This link looks invalid"
          message="The basket URL did not contain valid lot identifiers. Open your collection to build a basket again."
        >
          <p className="font-body text-sm">
            <Link href="/dashboard/portfolio" className="text-primary underline">
              Open your collection
            </Link>
          </p>
        </DashboardErrorAlert>
      ) : null}

      {notice === "not-winner" ? (
        <DashboardErrorAlert
          title="Some lots were not in your basket"
          message="Lots in the URL are not assigned to you as the winning bidder. Open your collection to start checkout from a won lot."
        >
          <Button variant="secondaryOutline" asChild>
            <Link href="/dashboard/portfolio">Open collection</Link>
          </Button>
        </DashboardErrorAlert>
      ) : null}

      {fetchFailureCount > 0 ? (
        <DashboardErrorAlert
          title="Some lots could not load"
          message={`${fetchFailureCount} lot${fetchFailureCount === 1 ? "" : "s"} could not be loaded. Try again or open your collection.`}
        >
          <Button variant="secondaryOutline" asChild>
            <Link href="/dashboard/portfolio">Open collection</Link>
          </Button>
        </DashboardErrorAlert>
      ) : null}

      {unauthorisedCount > 0 ? (
        <DashboardErrorAlert
          title="Some lots were skipped"
          message={`${unauthorisedCount} lot${unauthorisedCount === 1 ? "" : "s"} in the URL are not assigned to you as the winning bidder. They are not shown below.`}
        />
      ) : null}

      {skippedPricingCount > 0 ? (
        <DashboardErrorAlert
          title="Some lots were skipped"
          message={`${skippedPricingCount} lot${skippedPricingCount === 1 ? "" : "s"} could not load checkout pricing yet. They are not included in the basket below.`}
        />
      ) : null}

      {rows.length > 0 ? (
        <DashboardSection
          id="basket-checkout"
          title={`${rows.length} ${rows.length === 1 ? "lot" : "lots"} ready for settlement`}
        >
          <KpiRow
            variant="hero"
            columns={4}
            className="hidden lg:grid xl:grid-cols-1"
            aria-label="Basket total"
            tiles={[
              {
                id: "total",
                label: "Combined total",
                value: formatMoney(grandTotal.toFixed(2)),
                semanticTone: "emphasis",
                icon: <ShoppingBag className="size-5" aria-hidden />,
              },
            ]}
          />
          <CheckoutBasketPanel rows={rows} grandTotal={grandTotal} />
        </DashboardSection>
      ) : null}
    </DashboardPage>
  );
}
