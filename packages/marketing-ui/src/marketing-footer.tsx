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
  tagline: ReactNode;
  columns: ReadonlyArray<MarketingFooterColumn>;
  socials?: ReactNode;
  copyright: ReactNode;
  className?: string;
  headingId?: string;
  /** Defaults to a plain anchor; storefronts pass Next.js `Link`. */
  renderLink?: (link: MarketingFooterLink) => ReactNode;
};

export function MarketingFooter({
  logo,
  tagline,
  columns,
  socials,
  copyright,
  className,
  headingId = "marketing-footer-heading",
  renderLink,
}: MarketingFooterProps) {
  const headingClass =
    "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";
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
        <div className="flex flex-wrap items-center justify-between gap-8">
          {logo}
          <div className="font-headline text-lg font-light italic text-on-surface-variant">
            {tagline}
          </div>
        </div>
        <div
          className="h-px w-full max-w-[var(--container-inner,86rem)] bg-border-hairline"
          aria-hidden
        />
        <div
          className={cn(
            "grid max-w-[var(--container-inner,86rem)] grid-cols-1 gap-12",
            columns.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2",
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
            <div className="flex flex-col gap-4">
              <h3 className={headingClass}>Connect</h3>
              <div className="mt-1">{socials}</div>
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
