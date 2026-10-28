import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  loadBidCrossProductFooterLinks,
  loadBidProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { MarketingHeaderTitleProvider } from "@/lib/marketing/marketing-header-title-context";
import { loadCachedMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import type { ReactNode } from "react";

type BidSiteChromeProps = {
  /** Paths where the header starts transparent over a hero (the home page). */
  transparentPaths?: string[];
  /** Site-wide extras that sit inside the header's context (quick look, hotkeys, palette). */
  wrap?: (content: ReactNode) => ReactNode;
  children: ReactNode;
};

/**
 * The public lax.bid frame: the LAX top bar and Bid header, the page, then the Bid footer.
 * The marketing pages and a personal client's account pages share it, so they read as one site.
 */
export async function BidSiteChrome({
  transparentPaths,
  wrap = (content) => content,
  children,
}: BidSiteChromeProps) {
  const nav = await loadCachedMegaMenuSections();
  const laxProductLinks = loadBidProductDirectoryLinks();
  const crossProductFooterLinks = loadBidCrossProductFooterLinks();

  return (
    <>
      <div className="overflow-x-clip">
        <MarketingHeaderTitleProvider>
          {wrap(
            <>
              <SiteHeader
                nav={nav}
                laxProductLinks={laxProductLinks}
                {...(transparentPaths ? { transparentPaths } : {})}
              />
              {children}
            </>,
          )}
        </MarketingHeaderTitleProvider>
      </div>
      <SiteFooter crossProductLinks={crossProductFooterLinks} />
    </>
  );
}
