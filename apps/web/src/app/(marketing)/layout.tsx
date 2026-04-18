import { CommandPalette } from "@/components/layout/command-palette";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { ReactNode } from "react";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();

  return (
    <>
      <CommandPalette variant="marketing" />
      <SiteHeader user={user} />
      {children}
      <SiteFooter />
      <AuthRequiredToast />
    </>
  );
}
