import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";

export type ArtistDirectoryFilterLink = {
  label: string;
  href: string;
  count?: number | undefined;
  active: boolean;
};

type Props = {
  /** Section heading + groups of filter links. Server-rendered, no JS. */
  groups: Array<{ id: string; title: string; links: ArtistDirectoryFilterLink[] }>;
  /** Pre-built nationality facet links (includes "Any"). */
  nationalityLinks?: ArtistDirectoryFilterLink[];
  /** Builder for the "Clear all filters" link target. */
  clearHref?: string;
  /** Whether any user filter is currently applied (for showing the Clear link). */
  hasFilters?: boolean;
  /** Called when a filter link is activated (e.g. close mobile sheet). */
  onLinkClick?: () => void;
  className?: string;
};

/** Public directory side filter rail. Pure server component — every option is
 * a real `<a href>` so filters work without JS and stay crawlable. */
export function ArtistDirectoryFilters({
  groups,
  nationalityLinks,
  clearHref,
  hasFilters,
  onLinkClick,
  className,
}: Props) {
  const linkClickProps = onLinkClick ? { onClick: onLinkClick } : {};

  return (
    <div
      className={cn(
        "space-y-7 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto",
        className,
      )}
    >
      {hasFilters && clearHref ? (
        <div>
          <Link
            href={clearHref}
            {...linkClickProps}
            className={cn(
              "inline-flex items-center rounded-sm font-label text-[11px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline",
              FOCUS_RING,
            )}
          >
            Clear all filters
          </Link>
        </div>
      ) : null}
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`filter-${g.id}`}>
          <h3
            id={`filter-${g.id}`}
            className="mb-3 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant"
          >
            {g.title}
          </h3>
          <ul className="space-y-1">
            {g.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  {...linkClickProps}
                  aria-current={link.active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-body text-sm transition-colors",
                    FOCUS_RING,
                    link.active
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                  )}
                >
                  <span>{link.label}</span>
                  {typeof link.count === "number" ? (
                    <span className="font-mono text-[10px] tabular-nums text-on-surface-variant/80">
                      {link.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {nationalityLinks && nationalityLinks.length > 0 ? (
        <section aria-labelledby="filter-nationality">
          <h3
            id="filter-nationality"
            className="mb-3 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant"
          >
            Top nationalities
          </h3>
          <ul className="space-y-1">
            {nationalityLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  {...linkClickProps}
                  aria-current={link.active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-body text-sm transition-colors",
                    FOCUS_RING,
                    link.active
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                  )}
                >
                  <span>{link.label}</span>
                  {typeof link.count === "number" ? (
                    <span className="font-mono text-[10px] tabular-nums text-on-surface-variant/80">
                      {link.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
