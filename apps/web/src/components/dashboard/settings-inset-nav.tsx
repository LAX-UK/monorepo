"use client";

import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { cn } from "@auction/ui";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

/**
 * Only settings that belong to Bid. Name, email, password, two-step verification, sessions and
 * addresses are account-wide and live in LAX Account, reached by the one link below the list.
 */
const BID_SETTINGS: readonly NavItem[] = [
  {
    href: "/settings#bidding",
    label: "Bidding limits",
    match: (pathname) => pathname.startsWith("/settings/bidding"),
  },
  {
    href: "/settings#alerts",
    label: "Auction alerts and notifications",
    match: (pathname) => pathname.startsWith("/settings/notifications"),
  },
  {
    href: "/settings#interests",
    label: "Auction interests",
    match: (pathname) => pathname.startsWith("/settings/interests"),
  },
  {
    href: "/settings#appearance",
    label: "Appearance and layout",
    match: (pathname) => pathname.startsWith("/settings/appearance"),
  },
];

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

  return (
    <nav aria-label="Bid settings" className={cn("space-y-4", className)}>
      <InsetGroup label="Bid settings">
        {BID_SETTINGS.map((item) => (
          <SettingsNavRow
            key={item.href}
            href={item.href}
            label={item.label}
            active={item.match(pathname)}
          />
        ))}
      </InsetGroup>
      <InsetGroup label="Your account">
        <a href={laxAccountHomeUrl()} rel="noopener noreferrer" className="block">
          <ListRow
            title="LAX Account"
            subtitle="Manage your LAX Account: profile, security, addresses"
            trailing={
              <ArrowUpRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
            }
          />
        </a>
      </InsetGroup>
    </nav>
  );
}
