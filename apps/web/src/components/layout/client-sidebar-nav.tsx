"use client";

import { navBadgeClassName } from "@/lib/layout/nav-badge-classes";
import type { NavItem, NavSection } from "@/lib/shell/contracts";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  sections: readonly NavSection[];
  /** The sidebar is collapsed to icons. */
  labelsHidden: boolean;
  onNavigate?: () => void;
};

/** The block pinned to the foot of the menu: Notifications, Bid settings, LAX Account. */
const FOOT_SECTION_ID = "account";

function isActive(item: NavItem, pathname: string): boolean {
  return item.match
    ? item.match(pathname)
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ItemLink({
  item,
  labelsHidden,
  onNavigate,
}: {
  item: NavItem;
  labelsHidden: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = usePathname();
  const active = isActive(item, pathname);
  const Icon = item.icon;
  const className = cn(
    "group relative flex min-h-[var(--tap-target-min,44px)] items-center justify-center gap-3 rounded-lg px-2 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
    !labelsHidden && "justify-start px-3",
    "hover:bg-surface-container-high hover:text-on-surface",
    active &&
      "border-l-2 border-nav-active-border bg-nav-active-bg pl-[calc(0.75rem-2px)] text-on-surface",
  );
  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span
        className={cn(
          "min-w-0 flex-1 truncate whitespace-nowrap transition-[max-width,opacity] duration-150",
          labelsHidden ? "max-w-0 opacity-0" : "max-w-[11rem] opacity-100",
        )}
        aria-hidden={labelsHidden}
      >
        {item.label}
      </span>
      {item.external && !labelsHidden ? (
        <ArrowUpRight className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
      ) : null}
      {item.badge ? (
        <Badge
          className={cn(
            navBadgeClassName(item.badgeTone),
            labelsHidden && "absolute right-1 top-1",
          )}
          aria-label={`${item.badge > 99 ? "99+" : item.badge} pending ${item.label}`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </Badge>
      ) : null}
    </>
  );
  const common = {
    "aria-current": active ? ("page" as const) : undefined,
    "aria-label": item.external ? `${item.label} (opens LAX Account)` : item.label,
    className,
    ...(onNavigate ? { onClick: onNavigate } : {}),
  };
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        {item.external ? (
          <a href={item.href} rel="noopener noreferrer" {...common}>
            {content}
          </a>
        ) : (
          <Link href={item.href} {...common}>
            {content}
          </Link>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className={cn("hidden", labelsHidden && "lg:block")}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function Section({
  section,
  labelsHidden,
  onNavigate,
}: {
  section: NavSection;
  labelsHidden: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const headingId = `client-nav-${section.id}`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls; this groups links.
    <div role="group" {...(section.title ? { "aria-labelledby": headingId } : {})}>
      {section.title ? (
        labelsHidden ? (
          <div className="mx-2 mb-2 border-t border-shell-stroke" aria-hidden />
        ) : (
          <p id={headingId} className="mb-1 px-3 font-body text-xs text-on-surface-variant">
            {section.title}
          </p>
        )
      ) : null}
      {section.title && labelsHidden ? (
        <span id={headingId} className="sr-only">
          {section.title}
        </span>
      ) : null}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.id}>
            <ItemLink item={item} labelsHidden={labelsHidden} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The client menu as sections: Home for organisations, then Buying, Selling and Organisation,
 * with Notifications, Bid settings and LAX Account pinned to the foot.
 */
export function ClientSidebarNav({ sections, labelsHidden, onNavigate }: Props) {
  const body = sections.filter((section) => section.id !== FOOT_SECTION_ID);
  const foot = sections.find((section) => section.id === FOOT_SECTION_ID);
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-5">
        {body.map((section) => (
          <Section
            key={section.id}
            section={section}
            labelsHidden={labelsHidden}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {foot ? (
        <div className="mt-auto border-t border-shell-stroke pt-3">
          <Section section={foot} labelsHidden={labelsHidden} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  );
}
