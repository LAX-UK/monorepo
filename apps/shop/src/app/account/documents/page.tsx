import { ShopAccountLinkButton, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchPortalDocuments } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = shopPrivatePageTitle("Documents");

function formatDocumentKind(kind: string): string {
  return kind.replace(/_/g, " ");
}

export default async function ShopAccountDocumentsPage() {
  if (!isShopPayoutsEnabled()) {
    notFound();
  }

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/documents");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title="Documents"
        breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Documents" }]}
      >
        <ShopCatalogueStateRetryButton />
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalDocuments();

  return (
    <ShopAccountShell
      title="Documents"
      breadcrumbs={[{ label: "Account", href: "/account" }, { label: "Documents" }]}
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
            <li key={doc.documentId}>
              {doc.downloadUrl ? (
                <a href={doc.downloadUrl}>{formatDocumentKind(doc.kind)}</a>
              ) : (
                <span>{formatDocumentKind(doc.kind)} — available on request</span>
              )}{" "}
              <span className="text-on-surface-variant">
                ({new Date(doc.createdAt).toLocaleDateString()})
              </span>
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
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </ShopAccountShell>
  );
}
