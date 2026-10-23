"use client";

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
 * Only settings that belong to Bidding. Name, email, password, sessions and addresses are
 * account-wide and live in LAX Account; those pages still exist here but are not listed.
 */
const BID_SETTINGS: readonly NavItem[] = [
  {
    href: "/dashboard/settings/bidding",
    label: "Bidding limits",
    match: (pathname) => pathname.startsWith("/dashboard/settings/bidding"),
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Auction alerts and notifications",
    match: (pathname) => pathname.startsWith("/dashboard/settings/notifications"),
  },
  {
    href: "/dashboard/settings/interests",
    label: "Auction interests",
    match: (pathname) => pathname.startsWith("/dashboard/settings/interests"),
  },
  {
    href: "/dashboard/settings/appearance",
    label: "Appearance and layout",
    match: (pathname) => pathname.startsWith("/dashboard/settings/appearance"),
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
  /** LAX Account link for identity and security settings; omitted when the deployment has none. */
  accountHref?: string | null;
};

export function SettingsInsetNav({ className, accountHref = null }: SettingsInsetNavProps) {
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
      {accountHref ? (
        <InsetGroup label="Your account">
          <a href={accountHref} rel="noopener noreferrer" className="block">
            <ListRow
              title="Profile, security and sign-in"
              subtitle="Managed in LAX Account"
              trailing={
                <ArrowUpRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
              }
            />
          </a>
        </InsetGroup>
      ) : null}
    </nav>
  );
}
