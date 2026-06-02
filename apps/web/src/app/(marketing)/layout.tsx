import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import { MarketingLotQuickLookShell } from "@/components/marketing/lot-quick-look/marketing-lot-quick-look-shell";
import { MarketingGlobalHotkeys } from "@/lib/hotkeys/marketing-global-hotkeys";
import { MarketingHeaderTitleProvider } from "@/lib/marketing/marketing-header-title-context";
import { loadMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import type { ReactNode } from "react";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const nav = await loadMegaMenuSections();

  return (
    <>
      <div className="overflow-x-clip">
        <MarketingLotQuickLookShell>
          <MarketingHeaderTitleProvider>
            <CommandPaletteLazy variant="marketing" />
            <MarketingGlobalHotkeys />
            <SiteHeader nav={nav} transparentPaths={["/"]} />
            {children}
            <AuthRequiredToast />
          </MarketingHeaderTitleProvider>
        </MarketingLotQuickLookShell>
      </div>
      <SiteFooter />
    </>
  );
}
