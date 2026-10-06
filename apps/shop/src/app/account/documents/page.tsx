import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { resolvePortalDocumentKindLabel } from "@/lib/presenters/portal-document-kind.presenter";
import { formatShopDate } from "@/lib/presenters/shop-date.presenter";
import {
  fetchPortalDocuments,
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

export const metadata = shopPrivatePageTitle("Documents");

export default async function ShopAccountDocumentsPage() {
  if (!isShopPayoutsEnabled()) {
    notFound();
  }

  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/documents",
    portalOwnershipEnabled,
    payoutsEnabled,
    artistPortalEnabled,
  };

  const gate = gateShopAuthenticatedRoute(viewer, "/account/documents");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountDocuments.title}
        breadcrumbs={shopPageWayfinding.accountDocuments.breadcrumbs}
        {...shellNav}
      >
        <ShopCatalogueStateRetryButton />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalDocuments();

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountDocuments.title}
      breadcrumbs={shopPageWayfinding.accountDocuments.breadcrumbs}
      {...shellNav}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Sign in to view your documents."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/documents")}
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
          title="No documents yet"
          titleAs="h2"
          description="Certificates and invoices appear here when available."
        />
      ) : result.status === "ok" ? (
        <ul className="shop-account-list">
          {result.data.map((doc) => (
            <li key={doc.documentId} className="shop-account-list__row">
              <div className="shop-account-list__header">
                <span className="font-medium">{resolvePortalDocumentKindLabel(doc.kind)}</span>
                {doc.downloadUrl ? (
                  <a href={doc.downloadUrl} className="text-link shop-focus-ring">
                    Download
                  </a>
                ) : (
                  <DotStatusPill label="On request" tone="neutral" />
                )}
              </div>
              <dl className="shop-account-list__facts">
                <div>
                  <dt>Added</dt>
                  <dd>{formatShopDate(doc.createdAt)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Unavailable"
          titleAs="h2"
          description="We could not load documents. Try again shortly."
        />
      )}
    </ShopAccountShell>
  );
}
