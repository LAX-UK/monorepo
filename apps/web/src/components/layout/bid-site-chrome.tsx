import { AnnouncerProvider } from "@/components/layout/announcer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  loadBidCrossProductFooterLinks,
  loadBidFamilyLinks,
  loadBidProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { MarketingHeaderTitleProvider } from "@/lib/marketing/marketing-header-title-context";
import { loadCachedMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import { LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import type { ReactNode } from "react";

type BidSiteChromeProps = {
  /** Paths where the header starts transparent over a hero (the home page). */
  transparentPaths?: string[];
  /** Wraps the header and page in site-wide extras (quick look, hotkeys, palette, toasts). */
  wrap?: (content: ReactNode) => ReactNode;
  /**
   * Wraps the page in the site's single main landmark (the skip link's target). Pages that bring
   * their own main, such as the account workspace, leave it off.
   */
  mainLandmark?: boolean;
  children: ReactNode;
};

/**
 * The public lax.bid frame: the LAX top bar and Bid header, the page, then the Bid footer.
 * The marketing pages and a personal client's account pages share it, so they read as one site.
 * The frame sets the client density, so kit controls are 36px on a desktop and 44px on a phone.
 */
export async function BidSiteChrome({
  transparentPaths,
  wrap = (content) => content,
  mainLandmark = false,
  children,
}: BidSiteChromeProps) {
  const nav = await loadCachedMegaMenuSections();
  const laxProductLinks = loadBidProductDirectoryLinks();
  const crossProductFooterLinks = loadBidCrossProductFooterLinks();
  const familyLinks = loadBidFamilyLinks();

  return (
    <LaxDensityProvider density="client">
      <AnnouncerProvider>
        <div {...laxDensityAttributes("client")} data-bid-site="">
          <div className="overflow-x-clip">
            <MarketingHeaderTitleProvider>
              {wrap(
                <>
                  <SiteHeader
                    nav={nav}
                    laxProductLinks={laxProductLinks}
                    familyLinks={familyLinks}
                    {...(transparentPaths ? { transparentPaths } : {})}
                  />
                  {mainLandmark ? <main id="main-content">{children}</main> : children}
                </>,
              )}
            </MarketingHeaderTitleProvider>
          </div>
          <SiteFooter crossProductLinks={crossProductFooterLinks} />
        </div>
      </AnnouncerProvider>
    </LaxDensityProvider>
  );
}
