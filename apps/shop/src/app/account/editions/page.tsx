import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { fetchPortalEditions } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("My editions");

export default async function ShopAccountEditionsPage() {
  const viewer = await loadShopViewerState();
  if (viewer.kind === "guest") {
    redirect(shopStorefrontLoginHref("/account/editions"));
  }
  if (viewer.kind === "disabled") {
    redirect(viewer.accountHref ?? "/account/disabled");
  }
  if (viewer.kind === "unavailable") {
    return (
      <ShopAccountShell
        title="My editions"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        notice={{ variant: "warning", title: "Unavailable", description: viewer.message }}
      >
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalEditions();
  if (!result.ok) {
    const unavailable = "unavailable" in result && result.unavailable;
    return (
      <ShopAccountShell
        title="My editions"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        notice={{
          variant: "warning",
          title: unavailable ? "Ownership portal not enabled" : "Could not load editions",
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
    <ShopAccountShell title="My editions" breadcrumbs={shopPageWayfinding.account.breadcrumbs}>
      {result.items.length === 0 ? (
        <ShopAccountBodyText>You do not have any owned editions yet.</ShopAccountBodyText>
      ) : (
        <ul className="space-y-3 text-sm">
          {result.items.map((edition) => (
            <li key={edition.editionId} className="rounded-md border border-outline-variant p-3">
              <p className="font-medium text-on-surface">{edition.artworkTitle}</p>
              <p className="text-on-surface-variant">
                Edition {edition.editionNumber} · {edition.listingStatus} · {edition.custodyStatus}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ShopAccountLinkButton href="/account/sale-limits" label="Sale limits" variant="outline" />
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </ShopAccountShell>
  );
}
