"use client";

import {
  IDENTITY_ONBOARDING_PATH,
  dashboardIdentityOnboardingHref,
} from "@/lib/kyc/identity-onboarding";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string, tab: string | null) => boolean;
};

const identity: NavItem[] = [
  {
    href: "/dashboard/settings/profile",
    label: "Profile",
    match: (pathname) => pathname === "/dashboard/settings/profile",
  },
  {
    href: "/dashboard/settings/account",
    label: "Account & email",
    match: (pathname) =>
      pathname === "/dashboard/settings/account" ||
      pathname.startsWith("/dashboard/settings/account/"),
  },
  {
    href: dashboardIdentityOnboardingHref(),
    label: "Identity verification",
    match: (pathname) =>
      pathname === IDENTITY_ONBOARDING_PATH ||
      pathname.startsWith(`${IDENTITY_ONBOARDING_PATH}/`) ||
      pathname.startsWith("/dashboard/verify-identity"),
  },
  {
    href: "/dashboard/settings/addresses",
    label: "Addresses",
    match: (pathname) => pathname.startsWith("/dashboard/settings/addresses"),
  },
];

const security: NavItem[] = [
  {
    href: "/dashboard/settings/security",
    label: "Account security",
    match: (pathname, tab) =>
      pathname === "/dashboard/settings/security" ||
      pathname.startsWith("/dashboard/settings/security/") ||
      (pathname === "/dashboard/settings" && tab === "security"),
  },
  {
    href: "/dashboard/settings/security/two-factor",
    label: "Two-factor authentication",
    match: (pathname) => pathname.startsWith("/dashboard/settings/security/two-factor"),
  },
  {
    href: "/dashboard/settings/sessions",
    label: "Active sessions",
    match: (pathname) => pathname.startsWith("/dashboard/settings/sessions"),
  },
];

const preferences: NavItem[] = [
  {
    href: "/dashboard/settings/interests",
    label: "Auction interests",
    match: (pathname) => pathname.startsWith("/dashboard/settings/interests"),
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notifications",
    match: (pathname) => pathname.startsWith("/dashboard/settings/notifications"),
  },
  {
    href: "/dashboard/settings/appearance",
    label: "Appearance & layout",
    match: (pathname) => pathname.startsWith("/dashboard/settings/appearance"),
  },
  {
    href: "/dashboard/settings/bidding",
    label: "Bidding",
    match: (pathname) => pathname.startsWith("/dashboard/settings/bidding"),
  },
  {
    href: "/dashboard/settings/payment-methods",
    label: "Payment methods",
    match: (pathname) => pathname.startsWith("/dashboard/settings/payment-methods"),
  },
];

const SECTIONS = [
  { label: "Identity", items: identity },
  { label: "Security", items: security },
  { label: "Preferences", items: preferences },
] as const;

function SettingsNavRow({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className="block" {...(active ? { "aria-current": "page" as const } : {})}>
      <ListRow
        title={label}
        trailing={
          <ChevronRight
            className={cn("size-4 shrink-0", active ? "text-primary" : "text-on-surface-variant")}
            aria-hidden
          />
        }
        className={cn(active && "bg-primary-container/25 ring-1 ring-primary/20")}
      />
    </Link>
  );
}

type SettingsInsetNavProps = {
  className?: string;
};

export function SettingsInsetNav({ className }: SettingsInsetNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  return (
    <nav aria-label="Settings" className={cn("space-y-4", className)}>
      <Input
        type="search"
        placeholder="Find a setting…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter settings"
        className="h-9"
      />
      {filteredSections.map((section) => (
        <InsetGroup key={section.label} label={section.label}>
          {section.items.map((item) => (
            <SettingsNavRow
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(pathname, tab)}
            />
          ))}
        </InsetGroup>
      ))}
    </nav>
  );
}
