import { ShopAccountLinkButton, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchPortalSales } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Sales statement");

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function ShopAccountSalesPage() {
  if (!isShopPayoutsEnabled()) {
    redirect("/account/disabled");
  }
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/sales");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    redirect("/account");
  }

  const result = await fetchPortalSales();

  return (
    <ShopAccountShell
      title="Sales statement"
      breadcrumbs={[...(shopPageWayfinding.account.breadcrumbs ?? []), { label: "Sales" }]}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load your sales."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/sales")}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : result.status === "commerce_unavailable" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Ownership portal not enabled"
          titleAs="h2"
          description="This environment has not turned on the owner portal yet."
          actions={<ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>}
        />
      ) : result.status === "failed" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Could not load sales"
          titleAs="h2"
          description="Try again later."
          actions={<ShopCatalogueStateRetryButton />}
        />
      ) : result.status === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No sales yet"
          titleAs="h2"
          description="When editions sell, gross, fees and net will appear here with payout links."
          actions={<ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>}
        />
      ) : (
        <ul className="space-y-3 text-sm">
          {result.data.map((row) => (
            <li key={row.saleId} className="rounded-md border border-outline-variant p-3">
              <p className="font-medium text-on-surface">
                {row.artworkTitle}
                {row.editionNumber != null ? ` · Edition ${row.editionNumber}` : ""}
              </p>
              <p className="text-on-surface-variant capitalize">
                {row.channel.replace("_", " ")} · {new Date(row.soldAt).toLocaleDateString("en-GB")}
              </p>
              <p className="text-on-surface">
                Gross {formatPence(row.grossPence)} · Fees {formatPence(row.feesPence)} · Net{" "}
                {formatPence(row.netPence)}
              </p>
              <p className="text-on-surface-variant">
                Payout {row.payoutStatus} ·{" "}
                <a className="underline" href="/account/payouts">
                  View payouts
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </ShopAccountShell>
  );
}
