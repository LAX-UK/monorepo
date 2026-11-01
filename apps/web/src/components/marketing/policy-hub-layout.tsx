"use client";

import { policyRoutes } from "@/components/marketing/policy-routes";
import { LegalHub } from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bid's policy and information pages beside the shared policy list (`LegalHub`). */
export function PolicyHubLayout({ children }: Props) {
  const pathname = usePathname();
  const links = policyRoutes.map((route) => ({
    href: route.href,
    label: route.sidebarLabel,
    current: isActive(pathname, route.href),
  }));

  return (
    <div className="bg-page-bg pt-[var(--header-height)] dark:bg-background">
      <LegalHub label="Policies and information" links={links}>
        {children}
      </LegalHub>
    </div>
  );
}
