"use client";

import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { cn } from "@auction/ui";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function settingsPageTitle(pathname: string): string | null {
  if (pathname === "/dashboard/settings/profile") return "Profile";
  if (
    pathname === "/dashboard/settings/account" ||
    pathname.startsWith("/dashboard/settings/account/")
  )
    return "Account & email";
  if (pathname.startsWith("/dashboard/settings/addresses")) return "Addresses";
  if (pathname.startsWith("/dashboard/settings/security/two-factor"))
    return "Two-factor authentication";
  if (pathname.startsWith("/dashboard/settings/security")) return "Account security";
  if (pathname.startsWith("/dashboard/settings/sessions")) return "Active sessions";
  if (pathname.startsWith("/dashboard/settings/notifications")) return "Notifications";
  if (pathname.startsWith("/dashboard/settings/appearance")) return "Appearance & layout";
  if (pathname.startsWith("/dashboard/settings/bidding")) return "Bidding";
  if (pathname.startsWith("/dashboard/settings/payment-methods")) return "Payment methods";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return null;
}

/** Mobile settings chrome — hub nav or back link to the settings index. */
export function SettingsMobileHeader() {
  const pathname = usePathname();
  const isHub = pathname === "/dashboard/settings";
  const title = settingsPageTitle(pathname);

  if (isHub) {
    return (
      <div className="lg:hidden">
        <SettingsInsetNav />
      </div>
    );
  }

  if (!title || !pathname.startsWith("/dashboard/settings")) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <Link
        href="/dashboard/settings"
        className={cn(
          "mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-hairline px-3 py-2",
          "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant",
          "hover:bg-surface-container-high hover:text-on-surface",
        )}
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        All settings
      </Link>
      <h1 className="font-headline text-lg font-semibold text-on-surface">{title}</h1>
    </div>
  );
}

export function SettingsLayoutBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
