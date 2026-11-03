import { ORIGIN_PRODUCT_COOKIE } from "@/lib/origin-product";
import { loadAccountSession } from "@/server/application/load-account-session";
import { loadMenuSellerAccess } from "@/server/application/load-selling";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildAccountNav, buildProductBar } from "@/server/domain/account-nav.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { buildDeletionBannerVm } from "@/server/domain/deletion-banner.vm";
import { buildBackToProduct, originProductUrls } from "@/server/domain/origin-product";
import { showsSelling } from "@/server/domain/selling/selling-access";
import { cookies } from "next/headers";
import { cache } from "react";
import type { ReactNode } from "react";
import { DeletionScheduledBanner } from "./deletion-scheduled-banner";
import { AccountFrame, type PageWidth } from "./shell/account-frame";
import { type AccountViewer, toAccountViewer } from "./shell/account-viewer";

/** One session read per request, however many parts of the page ask who is signed in. */
const loadViewer = cache(async (): Promise<AccountViewer | null> => {
  const session = await loadAccountSession();
  return session.status === "ok" ? toAccountViewer(session.overview) : null;
});

/**
 * The person's scheduled deletion, if any, from the issuer's live facts. One read per request;
 * when the issuer cannot answer there is no banner, and the delete page still says the same.
 */
const loadDeletionBanner = cache(async () => {
  const session = await loadAccountSession({ withLiveSecurity: true });
  return session.status === "ok" ? buildDeletionBannerVm(session.liveSecurity) : null;
});

/**
 * The shell for a server-rendered page: the header, product bar and left menu from
 * `AccountFrame`, filled in with the signed-in person and the configured LAX products. A page that
 * has already read the person (with a live name, say) passes `viewer` so the header agrees with it.
 */
export async function AccountShell({
  children,
  width = "narrow",
  viewer: viewerProp,
  showDeletionBanner = true,
}: {
  children: ReactNode;
  width?: PageWidth;
  viewer?: AccountViewer | null;
  /** The delete page says this itself, so it turns the banner off. */
  showDeletionBanner?: boolean;
}) {
  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config);
  const viewer = viewerProp === undefined ? await loadViewer() : viewerProp;
  const sellerAccess = viewer ? await loadMenuSellerAccess() : null;
  const backToProduct = buildBackToProduct(
    (await cookies()).get(ORIGIN_PRODUCT_COOKIE)?.value,
    originProductUrls(config),
  );
  const banner = viewer && showDeletionBanner ? await loadDeletionBanner() : null;
  return (
    <AccountFrame
      backToProduct={backToProduct}
      viewer={viewer}
      nav={viewer ? buildAccountNav(links, { selling: showsSelling(sellerAccess) }) : []}
      products={buildProductBar(config)}
      support={links.support}
      width={width}
      notice={
        banner ? (
          <DeletionScheduledBanner dueOn={banner.dueOn} cancelHref={ACCOUNT_ROUTES.deleteAccount} />
        ) : null
      }
    >
      {children}
    </AccountFrame>
  );
}
