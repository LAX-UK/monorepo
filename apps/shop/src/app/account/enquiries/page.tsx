import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  fetchPortalEnquiries,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { buildPortalEnquiryListViewModel } from "@auction/shop-portal/vm";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Enquiries");

export default async function ShopAccountEnquiriesPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/enquiries",
    portalOwnershipEnabled,
    payoutsEnabled,
    artistPortalEnabled,
  };

  const gate = gateShopAuthenticatedRoute(viewer, "/account/enquiries");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title="Enquiries"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        {...shellNav}
      >
        <ShopCatalogueStateRetryButton />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalEnquiries();
  const rows =
    result.status === "ok"
      ? buildPortalEnquiryListViewModel(result.data, { artworkBasePath: "/artworks" })
      : [];

  return (
    <ShopAccountShell
      title="Enquiries"
      breadcrumbs={[
        ...shopPageWayfinding.account.breadcrumbs,
        { label: "Enquiries", href: "/account/enquiries" },
      ]}
      {...shellNav}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Sign in to view your enquiries."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/enquiries")}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : result.status !== "ok" ? (
        <ShopCatalogueStateRetryButton />
      ) : rows.length === 0 ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No enquiries yet"
          titleAs="h2"
          description="Original and viewing enquiries from LAX Shop and lax.art appear here."
        />
      ) : (
        <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/40 bg-surface">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={row.artworkHref}
                  className="font-medium text-on-surface shop-focus-ring"
                >
                  {row.artworkTitle}
                </Link>
                <p className="text-sm text-on-surface-variant">
                  {row.channelLabel} · {row.statusLabel}
                </p>
              </div>
              <time className="text-sm text-on-surface-variant" dateTime={row.createdAtIso}>
                {row.createdAtLabel}
              </time>
            </li>
          ))}
        </ul>
      )}
    </ShopAccountShell>
  );
}
