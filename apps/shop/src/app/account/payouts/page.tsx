import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { resolvePortalPayoutStatusPresentation } from "@/lib/presenters/portal-payout-status.presenter";
import { formatShopDate } from "@/lib/presenters/shop-date.presenter";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import {
  fetchPortalPayouts,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = shopPrivatePageTitle("Payouts");

export default async function ShopAccountPayoutsPage() {
  if (!isShopPayoutsEnabled()) {
    notFound();
  }

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/payouts");
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/payouts",
    portalOwnershipEnabled,
    payoutsEnabled,
    artistPortalEnabled,
  };

  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountPayouts.title}
        breadcrumbs={shopPageWayfinding.accountPayouts.breadcrumbs}
        {...shellNav}
      >
        <ShopCatalogueStateRetryButton />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalPayouts();

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountPayouts.title}
      breadcrumbs={shopPageWayfinding.accountPayouts.breadcrumbs}
      {...shellNav}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Sign in to view payout history."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/payouts")}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : result.status === "empty" || (result.status === "ok" && result.data.length === 0) ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No payouts yet"
          titleAs="h2"
          description="Payouts appear here after eligible sales."
        />
      ) : result.status === "ok" ? (
        <ul className="shop-account-list">
          {result.data.map((row) => {
            const status = resolvePortalPayoutStatusPresentation(row.status);
            return (
              <li
                key={row.payoutId}
                id={`payout-${row.payoutId}`}
                className="shop-account-list__row scroll-mt-24"
              >
                <div className="shop-account-list__header">
                  <span className="font-medium">Payout</span>
                  <DotStatusPill label={status.label} tone={status.tone} />
                </div>
                <dl className="shop-account-list__facts">
                  <div>
                    <dt>Gross</dt>
                    <dd>{formatGbpPence(row.grossPence)}</dd>
                  </div>
                  <div>
                    <dt>Deductions</dt>
                    <dd>{formatGbpPence(row.deductionsPence)}</dd>
                  </div>
                  <div>
                    <dt>Net</dt>
                    <dd>{formatGbpPence(row.netPence)}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{formatShopDate(row.payoutDueAt)}</dd>
                  </div>
                  {row.paidAt ? (
                    <div>
                      <dt>Paid</dt>
                      <dd>{formatShopDate(row.paidAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Unavailable"
          titleAs="h2"
          description="We could not load payouts. Try again shortly."
        />
      )}
    </ShopAccountShell>
  );
}
