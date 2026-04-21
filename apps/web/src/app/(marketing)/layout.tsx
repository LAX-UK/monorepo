import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import { LiveSaleAnnouncement } from "@/components/marketing/live-sale-announcement";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { loadMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import type { ReactNode } from "react";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const [user, nav, data] = await Promise.all([
    getServerSessionUser(),
    loadMegaMenuSections(),
    getServerDataContainer(),
  ]);

  return (
    <>
      <CommandPaletteLazy variant="marketing" />
      <SiteHeader user={user} nav={nav} />
      <LiveSaleAnnouncement reader={data.liveSale} />
      {children}
      <SiteFooter />
      <AuthRequiredToast />
    </>
  );
}
