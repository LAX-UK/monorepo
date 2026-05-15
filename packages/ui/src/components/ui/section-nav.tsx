import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type SectionNavItem = {
  href: string;
  label: string;
  /** When true, link is highlighted */
  active?: boolean;
};

export type SectionNavLinkRenderProps = {
  href: string;
  label: string;
  active: boolean;
  className: string;
  "aria-current"?: "page" | undefined;
};

export type SectionNavProps = {
  items: readonly SectionNavItem[];
  className?: string;
  /** Accessible name for the nav landmark */
  "aria-label"?: string;
  /**
   * Custom link renderer (e.g. Next.js `Link`) while keeping SectionNav styling and
   * `aria-current` wiring.
   */
  renderLink?: (props: SectionNavLinkRenderProps) => ReactNode;
};

const linkClassName = (active: boolean) =>
  cn(
    "block rounded-md border-l-4 px-3 py-2.5 font-label text-xs font-medium uppercase tracking-widest transition-colors",
    active
      ? "border-primary bg-surface-container-low text-on-surface"
      : "border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface",
  );

export function SectionNav({
  items,
  className,
  "aria-label": ariaLabel = "Section",
  renderLink,
}: SectionNavProps) {
  return (
    <nav className={cn("space-y-1", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = Boolean(item.active);
        const ariaCurrent = active ? ("page" as const) : undefined;
        const classNames = linkClassName(active);

        if (renderLink) {
          return (
            <Fragment key={item.href}>
              {renderLink({
                href: item.href,
                label: item.label,
                active,
                className: classNames,
                "aria-current": ariaCurrent,
              })}
            </Fragment>
          );
        }

        return (
          <a key={item.href} href={item.href} aria-current={ariaCurrent} className={classNames}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
