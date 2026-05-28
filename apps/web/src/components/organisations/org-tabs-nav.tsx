"use client";

import { cn } from "@auction/ui";
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

/** Per-org secondary navigation — horizontal scroll below `lg`, vertical sidebar at `lg+`. */
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
    <>
      <nav
        aria-label="Organisation"
        className={cn(
          "sticky top-[var(--header-height-mobile,56px)] z-10 -mx-4 border-b border-border-hairline bg-surface/95 backdrop-blur-sm lg:hidden",
          className,
        )}
      >
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-4 py-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              prefetch
              className={cn(
                "shrink-0 snap-start rounded-md border px-3 py-2 font-label text-xs font-medium uppercase tracking-widest transition-colors",
                item.active
                  ? "border-primary bg-surface-container-low text-on-surface"
                  : "border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <SectionNav
        aria-label="Organisation"
        className={cn("hidden lg:block", className)}
        items={items}
        renderLink={({ href, label, className: linkClass, "aria-current": ariaCurrent }) => (
          <Link href={href} className={linkClass} aria-current={ariaCurrent} prefetch>
            {label}
          </Link>
        )}
      />
    </>
  );
}
