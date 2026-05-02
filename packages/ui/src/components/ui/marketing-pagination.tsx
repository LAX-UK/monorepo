import * as React from "react";
import { cn } from "../../lib/utils.js";

export type MarketingPaginationPage = {
  page: number;
  href: string;
  current?: boolean;
};

export type MarketingPaginationProps = {
  "aria-label"?: string;
  className?: string;
  /** Previous link — pass `null` href when disabled */
  prev: { label?: React.ReactNode; href: string | null };
  /** Next link — pass `null` href when disabled */
  next: { label?: React.ReactNode; href: string | null };
  /** Page number links in the window */
  pages: readonly MarketingPaginationPage[];
  /** Optional trailing page (e.g. last page) */
  trailingPage?: { page: number; href: string };
  /** Show ellipsis before trailing */
  showEllipsis?: boolean;
  /** Render link — default `<a>` */
  renderLink?: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
    "aria-current"?: "page";
  }) => React.ReactElement;
};

function defaultRenderLink({
  href,
  className,
  children,
  "aria-current": ariaCurrent,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-current"?: "page";
}) {
  return (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  );
}

/**
 * Landmark pagination: disabled steps are `<span>`, not inert links.
 */
export function MarketingPagination({
  "aria-label": ariaLabel = "Pagination",
  className,
  prev,
  next,
  pages,
  trailingPage,
  showEllipsis,
  renderLink = defaultRenderLink,
}: MarketingPaginationProps) {
  const Link = renderLink;
  return (
    <nav aria-label={ariaLabel} className={cn(className)}>
      <div className="flex items-center gap-8 md:gap-12">
        {prev.href ? (
          Link({
            href: prev.href,
            className:
              "flex items-center gap-4 font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            children: prev.label ?? "Previous",
          })
        ) : (
          <span className="flex cursor-not-allowed items-center gap-4 font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant/40">
            {prev.label ?? "Previous"}
          </span>
        )}
        <div className="flex items-center gap-6 md:gap-8">
          {pages.map((p) => (
            <React.Fragment key={p.page}>
              {Link(
                p.current
                  ? {
                      href: p.href,
                      "aria-current": "page" as const,
                      className: cn(
                        "font-label text-xs uppercase tracking-[0.2em] transition-colors focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        "font-bold text-primary",
                      ),
                      children: String(p.page).padStart(2, "0"),
                    }
                  : {
                      href: p.href,
                      className: cn(
                        "font-label text-xs uppercase tracking-[0.2em] transition-colors focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        "text-on-surface-variant hover:text-on-surface",
                      ),
                      children: String(p.page).padStart(2, "0"),
                    },
              )}
            </React.Fragment>
          ))}
          {showEllipsis ? (
            <span
              className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant"
              aria-hidden
            >
              …
            </span>
          ) : null}
          {trailingPage
            ? Link({
                href: trailingPage.href,
                className:
                  "font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                children: String(trailingPage.page).padStart(2, "0"),
              })
            : null}
        </div>
        {next.href ? (
          Link({
            href: next.href,
            className:
              "flex items-center gap-4 font-label text-xs uppercase tracking-[0.2em] text-on-surface transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            children: next.label ?? "Next",
          })
        ) : (
          <span className="flex cursor-not-allowed items-center gap-4 font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant/40">
            {next.label ?? "Next"}
          </span>
        )}
      </div>
    </nav>
  );
}
