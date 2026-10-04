import { ShopAccountLinkButton, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchPortalPayouts } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = shopPrivatePageTitle("Payouts");

export default async function ShopAccountPayoutsPage() {
  if (!isShopPayoutsEnabled()) {
    notFound();
  }

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/payouts");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title="Payouts"
        breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Payouts" }]}
      >
        <ShopCatalogueStateRetryButton />
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalPayouts();

  return (
    <ShopAccountShell
      title="Payouts"
      breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Payouts" }]}
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
          {result.data.map((row) => (
            <li key={row.payoutId}>
              {row.status} — £{(row.netPence / 100).toFixed(2)}
              {row.payoutDueAt ? ` (due ${new Date(row.payoutDueAt).toLocaleDateString()})` : null}
            </li>
          ))}
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
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </ShopAccountShell>
  );
}
