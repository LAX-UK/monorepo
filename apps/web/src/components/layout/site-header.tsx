import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { utilityNav } from "@/components/layout/header-nav-config";
import type { LaxFamilyLinkVm, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LaxFamilyBar } from "@auction/marketing-ui/lax-family-bar";
import { BidHeaderLockup } from "./bid-header-lockup";
import { SiteHeaderChrome, type SiteHeaderChromeVariant } from "./site-header-chrome";

type SiteHeaderProps = {
  nav?: MegaMenuSection[];
  chromeVariant?: SiteHeaderChromeVariant;
  laxProductLinks?: LaxProductLinkVm[];
  /** The LAX top bar: the products, then LAX Account. */
  familyLinks?: LaxFamilyLinkVm[];
};

/**
 * The Bid header. The parts that only show links and the logo (the LAX top bar and the lockup)
 * are drawn on the server and handed to the interactive bar as slots, so their code is not sent
 * to the browser. They take the header's tone from its `data-header-tone`, which the bar sets as
 * the page scrolls, so no tone has to be passed to them.
 */
export function SiteHeader({ familyLinks = [], ...rest }: SiteHeaderProps) {
  return (
    <SiteHeaderChrome
      {...rest}
      familyLinks={familyLinks}
      familyBar={<LaxFamilyBar links={familyLinks} helpLinks={utilityNav} tone="follow-header" />}
      lockup={<BidHeaderLockup />}
    />
  );
}
