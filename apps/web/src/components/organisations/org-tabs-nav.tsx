"use client";

import { SectionNav } from "@auction/ui/components/section-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type OrgTabItem = { href: string; label: string };

type Props = {
  orgId: string;
  className?: string;
};

const TAB_SUFFIXES: { suffix: string; label: string }[] = [
  { suffix: "", label: "Overview" },
  { suffix: "/members", label: "Members" },
  { suffix: "/profile", label: "Profile" },
  { suffix: "/documents", label: "Documents" },
  { suffix: "/connect", label: "Payout setup" },
];

/** Per-org secondary navigation using `@auction/ui` `SectionNav` + Next `Link`. */
export function OrgTabsNav({ orgId, className }: Props) {
  const pathname = usePathname();
  const base = `/dashboard/organisations/${orgId}`;

  const items = TAB_SUFFIXES.map(({ suffix, label }) => {
    const href = `${base}${suffix}`;
    const active =
      suffix === ""
        ? pathname === base || pathname === `${base}/`
        : pathname === href || pathname.startsWith(`${href}/`);
    return { href, label, active };
  });

  return (
    <SectionNav
      aria-label="Organisation"
      {...(className !== undefined ? { className } : {})}
      items={items}
      renderLink={({ href, label, className: linkClass, "aria-current": ariaCurrent }) => (
        <Link href={href} className={linkClass} aria-current={ariaCurrent} prefetch>
          {label}
        </Link>
      )}
    />
  );
}
