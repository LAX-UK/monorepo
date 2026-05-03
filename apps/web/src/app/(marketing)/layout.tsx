import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { loadMegaMenuSections } from "@/lib/marketing/mega-menu-sections.server";
import type { ReactNode } from "react";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const [user, nav] = await Promise.all([getServerSessionUser(), loadMegaMenuSections()]);

  return (
    <>
      <CommandPaletteLazy variant="marketing" />
      <SiteHeader user={user} nav={nav} transparentPaths={["/"]} />
      {children}
      <SiteFooter />
      <AuthRequiredToast />
    </>
  );
}
