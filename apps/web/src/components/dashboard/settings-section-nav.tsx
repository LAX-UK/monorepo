"use client";

import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const primary = [
  {
    href: "/dashboard/settings",
    label: "My profile",
    match: (pathname: string, tab: string | null) =>
      (pathname === "/dashboard/settings" && tab !== "security") ||
      pathname === "/dashboard/settings/profile",
  },
  {
    href: "/dashboard/settings?tab=security",
    label: "Account security",
    match: (pathname: string, tab: string | null) =>
      (pathname === "/dashboard/settings" && tab === "security") ||
      pathname === "/dashboard/settings/security",
  },
  {
    href: "/dashboard/settings/sessions",
    label: "Active sessions",
    match: (pathname: string, _tab: string | null) =>
      pathname === "/dashboard/settings/sessions" ||
      pathname.startsWith("/dashboard/settings/sessions/"),
  },
  {
    href: "/dashboard/settings/appearance",
    label: "Appearance & layout",
    match: (pathname: string, _tab: string | null) =>
      pathname === "/dashboard/settings/appearance" ||
      pathname.startsWith("/dashboard/settings/appearance/"),
  },
] as const;

const secondary = [
  { href: "/dashboard/settings/account", label: "Account & email" },
  { href: "/dashboard/settings/addresses", label: "Addresses" },
  { href: "/dashboard/settings/payment-methods", label: "Payment methods" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
  { href: "/dashboard/settings/bidding", label: "Bidding" },
  { href: "/dashboard/verify-identity", label: "Identity verification" },
] as const;

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2 font-label text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-primary-container/50 text-primary"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function SettingsSectionNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav aria-label="Settings" className="flex flex-col gap-4 p-2">
      <div>
        <p className="px-3 pb-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Account
        </p>
        <div className="flex flex-col gap-0.5">
          {primary.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(pathname, tab)}
            />
          ))}
        </div>
      </div>
      <div className="border-t border-outline-variant/20 pt-2">
        <p className="px-3 pb-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          More settings
        </p>
        <div className="flex flex-col gap-0.5">
          {secondary.map((item) => {
            const active =
              pathname === item.href ||
              (item.href.startsWith("/dashboard/settings") && pathname.startsWith(`${item.href}/`));
            return <NavLink key={item.href} href={item.href} label={item.label} active={active} />;
          })}
        </div>
      </div>
    </nav>
  );
}
