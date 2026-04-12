import { CommandPalette } from "@/components/layout/command-palette";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthRequiredToast } from "@/components/marketing/auth-required-toast";
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CommandPalette variant="marketing" />
      <SiteHeader />
      {children}
      <SiteFooter />
      <AuthRequiredToast />
    </>
  );
}
