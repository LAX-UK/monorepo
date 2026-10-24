import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingFooterColumn = {
  id: string;
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
  /** Non-link status line after the links (e.g. "Sign-in status unavailable"). */
  note?: string;
};

export type MarketingFooterLink = { label: string; href: string };

export type MarketingFooterProps = {
  logo: ReactNode;
  columns: ReadonlyArray<MarketingFooterColumn>;
  socials?: ReactNode;
  copyright: ReactNode;
  className?: string;
  headingId?: string;
  /** Defaults to a plain anchor; storefronts pass Next.js `Link`. */
  renderLink?: (link: MarketingFooterLink) => ReactNode;
};

/** One desktop row: columns plus the Connect column when socials are present. */
const DESKTOP_GRID_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function MarketingFooter({
  logo,
  columns,
  socials,
  copyright,
  className,
  headingId = "marketing-footer-heading",
  renderLink,
}: MarketingFooterProps) {
  const headingClass =
    "marketing-footer__heading font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";
  const linkClass = cn(
    "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
    FOCUS_RING,
  );

  return (
    <footer
      className={cn("w-full bg-[var(--color-footer-bg,#ededef)]", className)}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="sr-only">
        Site footer
      </h2>
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,90rem)] flex-col gap-12 py-12",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <div className="flex items-center">{logo}</div>
        <div
          className="h-px w-full max-w-[var(--container-inner,86rem)] bg-border-hairline"
          aria-hidden
        />
        <div
          className={cn(
            "grid max-w-[var(--container-inner,86rem)] grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-3",
            DESKTOP_GRID_COLUMNS[Math.min(columns.length + (socials ? 1 : 0), 6)],
          )}
        >
          {columns.map((column) => (
            <nav key={column.id} aria-labelledby={`${headingId}-${column.id}`}>
              <h3 id={`${headingId}-${column.id}`} className={headingClass}>
                {column.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {renderLink ? (
                      renderLink(link)
                    ) : (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
                {column.note ? (
                  <li>
                    <span className="font-footer-links text-base text-on-surface-variant">
                      {column.note}
                    </span>
                  </li>
                ) : null}
              </ul>
            </nav>
          ))}
          {socials ? (
            <div>
              <h3 className={headingClass}>Connect</h3>
              <div className="mt-4">{socials}</div>
            </div>
          ) : null}
        </div>
        <div
          className="h-px w-full max-w-[var(--container-inner,86rem)] bg-border-hairline"
          aria-hidden
        />
        <p className="font-supporting text-sm text-on-surface-variant">{copyright}</p>
      </div>
    </footer>
  );
}
