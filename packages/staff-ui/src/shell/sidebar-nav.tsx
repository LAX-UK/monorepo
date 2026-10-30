"use client";

import { Count, type LinkComponent } from "@auction/ui/lax";
import { resolveActiveNavHref } from "@auction/ui/shell";
import { cn } from "../lib/cn.js";
import { StaffTooltip } from "../primitives/menu.js";
import type { StaffNavGroup, StaffNavItem } from "./types.js";

export function resolveActiveItem(
  pathname: string,
  groups: readonly StaffNavGroup[],
): StaffNavItem | null {
  const items = groups.flatMap((group) => group.items);
  const matched = items.find((item) => item.match?.(pathname));
  if (matched) return matched;
  const href = resolveActiveNavHref(
    pathname,
    items.filter((item) => !item.match).map((item) => item.href),
  );
  return items.find((item) => item.href === href) ?? null;
}

/**
 * The grouped page list. 32px rows, 16px icons, sentence-case group titles. The active page has
 * the selected tint and a 2px product-accent bar, the one place the accent appears in the nav.
 * Collapsed, it is a 56px rail of icons with tooltips.
 */
export function SidebarNav({
  groups,
  pathname,
  Link,
  collapsed = false,
  onNavigate,
}: {
  groups: readonly StaffNavGroup[];
  pathname: string;
  Link: LinkComponent;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = resolveActiveItem(pathname, groups);
  return (
    <nav aria-label="Main" className="flex flex-col gap-4 px-2 py-3">
      {groups.map((group) => {
        const headingId = `staff-nav-${group.id}`;
        return (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.title ? (
              collapsed ? (
                <span aria-hidden className="mx-2 mb-1 h-px bg-staff-line" />
              ) : (
                <p
                  id={headingId}
                  className="flex h-control-xs items-center px-2 text-staff-xs font-medium text-staff-subtle"
                >
                  {group.title}
                </p>
              )
            ) : null}
            <ul
              {...(group.title && !collapsed
                ? { "aria-labelledby": headingId }
                : group.title
                  ? { "aria-label": group.title }
                  : {})}
              className="flex flex-col gap-0.5"
            >
              {group.items.map((item) => {
                const isActive = active?.href === item.href;
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    {...(isActive ? { "aria-current": "page" as const } : {})}
                    {...(collapsed ? { "aria-label": item.label } : {})}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                    className={cn(
                      "staff-focus staff-target group/nav relative flex h-control-sm items-center gap-2.5 rounded-staff-sm px-2 text-staff-sm transition-colors duration-150",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-staff-selected font-medium text-staff-fg"
                        : "text-staff-muted hover:bg-staff-hover hover:text-staff-fg",
                    )}
                  >
                    {isActive ? (
                      <span
                        aria-hidden
                        className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-staff-accent"
                      />
                    ) : null}
                    <span className="relative flex shrink-0">
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4",
                          isActive
                            ? "text-staff-fg"
                            : "text-staff-subtle group-hover/nav:text-staff-fg",
                        )}
                      />
                      {collapsed && item.count ? (
                        <span
                          aria-hidden
                          className="absolute -top-1 -right-1 size-2 rounded-full bg-staff-ink ring-2 ring-staff-sunken"
                        />
                      ) : null}
                    </span>
                    {collapsed ? null : (
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    )}
                    {!collapsed && item.count ? (
                      <Count value={item.count} tone={item.countTone ?? "neutral"} />
                    ) : null}
                    {item.count ? <span className="sr-only">, {item.count} waiting</span> : null}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <StaffTooltip label={item.label} side="right">
                        {link}
                      </StaffTooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
