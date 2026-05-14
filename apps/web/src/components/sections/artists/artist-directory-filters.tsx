import type { PublicArtistDirectoryFacets } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

type FilterLink = {
  label: string;
  href: string;
  count?: number | undefined;
  active: boolean;
};

type Props = {
  /** Section heading + groups of filter links. Server-rendered, no JS. */
  groups: Array<{ id: string; title: string; links: FilterLink[] }>;
  /** Top nationalities, rendered as a separate compact list. */
  nationalities?: PublicArtistDirectoryFacets["topNationalities"];
  /** Per-nationality URL builder (path-segment routes pass query, not segment). */
  buildNationalityHref?: (value: string | null) => string;
  /** Currently active nationality filter (null when not set). */
  activeNationality?: string | null;
  /** Builder for the "Clear all filters" link target. */
  clearHref?: string;
  /** Whether any user filter is currently applied (for showing the Clear link). */
  hasFilters?: boolean;
  className?: string;
};

/** Public directory side filter rail. Pure server component — every option is
 * a real `<a href>` so filters work without JS and stay crawlable. */
export function ArtistDirectoryFilters({
  groups,
  nationalities,
  buildNationalityHref,
  activeNationality,
  clearHref,
  hasFilters,
  className,
}: Props) {
  return (
    <aside
      aria-label="Filters"
      className={cn(
        "space-y-7 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto",
        className,
      )}
    >
      {hasFilters && clearHref ? (
        <div>
          <Link
            href={clearHref}
            className="inline-flex items-center font-label text-[11px] uppercase tracking-widest text-primary hover:underline"
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
                  aria-current={link.active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-body text-sm transition-colors",
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
      {nationalities && nationalities.length > 0 && buildNationalityHref ? (
        <section aria-labelledby="filter-nationality">
          <h3
            id="filter-nationality"
            className="mb-3 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant"
          >
            Top nationalities
          </h3>
          <ul className="space-y-1">
            <li>
              <Link
                href={buildNationalityHref(null)}
                aria-current={!activeNationality ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-body text-sm",
                  !activeNationality
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                )}
              >
                <span>Any</span>
              </Link>
            </li>
            {nationalities.map((n) => {
              const active = activeNationality?.toLowerCase() === n.value.toLowerCase();
              return (
                <li key={n.value}>
                  <Link
                    href={buildNationalityHref(n.value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-body text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                    )}
                  >
                    <span>{n.value}</span>
                    <span className="font-mono text-[10px] tabular-nums text-on-surface-variant/80">
                      {n.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
