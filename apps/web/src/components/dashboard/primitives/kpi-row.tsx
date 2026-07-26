import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import { type AccentTrack, accentHeroBorderClass } from "@/lib/dashboard/accent-track";
import { cn } from "@auction/ui";
import { KpiTile } from "@auction/ui/components/kpi-tile";
import { StatStrip } from "@auction/ui/components/stat-strip";
import Link from "next/link";

export type { KpiRowTile };

export type KpiRowProps = {
  tiles: readonly KpiRowTile[];
  /** Hero row gets focal elevation (shadow-lg wrapper). */
  variant?: "default" | "hero";
  /** When true, skip outer chrome (for use inside OverviewHeroBand). */
  embedded?: boolean;
  columns?: 3 | 4 | 5 | 6;
  sticky?: boolean;
  track?: AccentTrack;
  className?: string;
  /** Extra responsive grid classes merged into the underlying `StatStrip`. */
  stripClassName?: string;
  "aria-label"?: string;
};

/** Unified KPI row for dashboard and admin — wraps `StatStrip` + `KpiTile`. */
export function KpiRow({
  tiles,
  variant = "default",
  embedded = false,
  columns = 4,
  sticky,
  track = "buying",
  className,
  stripClassName,
  "aria-label": ariaLabel = "Summary at a glance",
}: KpiRowProps) {
  const columnClass =
    columns === 6
      ? "md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6"
      : columns === 5
        ? "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        : columns === 3
          ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          : "md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4";

  const showHeroChrome = variant === "hero" && !embedded;

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        showHeroChrome &&
          cn(
            "rounded-xl border bg-surface-container-lowest p-4 shadow-lg sm:p-5",
            accentHeroBorderClass(track),
          ),
        className,
      )}
    >
      <StatStrip {...(sticky ? { sticky: true } : {})} className={cn(columnClass, stripClassName)}>
        {tiles.map((tile, index) => {
          const { id, href, ...tileProps } = tile;
          const content = (
            <KpiTile
              {...tileProps}
              clickable={Boolean(href) || tileProps.clickable === true}
              variant={tileProps.variant ?? "default"}
            />
          );
          if (href) {
            return (
              <Link
                key={id ?? `${String(tile.label)}-${index}`}
                href={href}
                className="block h-full min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {content}
              </Link>
            );
          }
          return (
            <div key={id ?? `${String(tile.label)}-${index}`} className="h-full min-w-0">
              {content}
            </div>
          );
        })}
      </StatStrip>
    </section>
  );
}
