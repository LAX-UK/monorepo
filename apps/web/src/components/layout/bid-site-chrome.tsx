import { AnnouncerProvider } from "@/components/layout/announcer";
import { BidBottomTabBar } from "@/components/layout/bid-bottom-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  loadBidCrossProductFooterLinks,
  loadBidFamilyLinks,
  loadBidProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { MarketingHeaderTitleProvider } from "@/lib/marketing/marketing-header-title-context";
import { loadCachedMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import { NavActivityProvider } from "@/lib/marketing/nav-activity-context";
import { loadNavActivity } from "@/lib/marketing/nav-activity.server";
import { MarketingBottomBarSpace } from "@auction/marketing-ui";
import { LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import type { ReactNode } from "react";

type BidSiteChromeProps = {
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
 * On phones it also carries the docked tab bar (public pages only) and reserves its space once,
 * after the footer. The frame sets the client density, so kit controls are 36px on a desktop and 44px on a phone.
 */
export async function BidSiteChrome({
  wrap = (content) => content,
  mainLandmark = false,
  children,
}: BidSiteChromeProps) {
  const [nav, navActivity] = await Promise.all([loadCachedMegaMenuSections(), loadNavActivity()]);
  const laxProductLinks = loadBidProductDirectoryLinks();
  const crossProductFooterLinks = loadBidCrossProductFooterLinks();
  const familyLinks = loadBidFamilyLinks();

  return (
    <LaxDensityProvider density="client">
      <AnnouncerProvider>
        <div {...laxDensityAttributes("client")} data-bid-site="">
          <div className="overflow-x-clip">
            <NavActivityProvider activity={navActivity}>
              <MarketingHeaderTitleProvider>
                {wrap(
                  <>
                    <SiteHeader
                      nav={nav}
                      laxProductLinks={laxProductLinks}
                      familyLinks={familyLinks}
                    />
                    {mainLandmark ? <main id="main-content">{children}</main> : children}
                  </>,
                )}
              </MarketingHeaderTitleProvider>
            </NavActivityProvider>
          </div>
          <SiteFooter crossProductLinks={crossProductFooterLinks} />
          {/* The one place the docked tab bar's space is reserved: the end of the page, on the
              footer's own grey so the page never ends on a white strip. */}
          <div className="bg-[var(--color-footer-bg,#ededef)]">
            <MarketingBottomBarSpace />
          </div>
          <BidBottomTabBar />
        </div>
      </AnnouncerProvider>
    </LaxDensityProvider>
  );
}
