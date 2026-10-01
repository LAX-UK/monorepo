import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { fetchPortalSaleAuthority } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Sale limits");

export default async function ShopAccountSaleLimitsPage() {
  const viewer = await loadShopViewerState();
  if (viewer.kind === "guest") {
    redirect(shopStorefrontLoginHref("/account/sale-limits"));
  }
  if (viewer.kind === "disabled") {
    redirect(viewer.accountHref ?? "/account/disabled");
  }
  if (viewer.kind === "unavailable") {
    return (
      <ShopAccountShell
        title="Sale limits"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        notice={{ variant: "warning", title: "Unavailable", description: viewer.message }}
      >
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalSaleAuthority();
  if (!result.ok) {
    const unavailable = "unavailable" in result && result.unavailable;
    return (
      <ShopAccountShell
        title="Sale limits"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        notice={{
          variant: "warning",
          title: unavailable ? "Ownership portal not enabled" : "Could not load sale limits",
          description: unavailable
            ? "This environment has not turned on the owner portal yet."
            : "Try again later or contact support if this persists.",
        }}
      >
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  return (
    <ShopAccountShell title="Sale limits" breadcrumbs={shopPageWayfinding.account.breadcrumbs}>
      <ShopAccountBodyText>
        These limits show how many of your editions are authorised for sale. Contact your account
        manager to request changes.
      </ShopAccountBodyText>
      {result.items.length === 0 ? (
        <ShopAccountBodyText>No sale authority records yet.</ShopAccountBodyText>
      ) : (
        <ul className="space-y-3 text-sm">
          {result.items.map((row) => (
            <li key={row.artworkId} className="rounded-md border border-outline-variant p-3">
              <p className="font-medium text-on-surface">{row.artworkTitle}</p>
              <p className="text-on-surface-variant">
                Authorised: {row.authorisedCount} · Committed: {row.committedCount}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ShopAccountLinkButton href="/account/editions" label="My editions" variant="outline" />
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </ShopAccountShell>
  );
}
