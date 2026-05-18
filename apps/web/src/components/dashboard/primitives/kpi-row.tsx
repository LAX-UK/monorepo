import { type AccentTrack, accentHeroBorderClass } from "@/lib/dashboard/accent-track";
import { cn } from "@auction/ui";
import { KpiTile, type KpiTileProps } from "@auction/ui/components/kpi-tile";
import { StatStrip } from "@auction/ui/components/stat-strip";

export type KpiRowTile = KpiTileProps & { id?: string };

export type KpiRowProps = {
  tiles: readonly KpiRowTile[];
  /** Hero row gets focal elevation (shadow-lg wrapper). */
  variant?: "default" | "hero";
  /** When true, skip outer chrome (for use inside OverviewHeroBand). */
  embedded?: boolean;
  columns?: 4 | 5 | 6;
  sticky?: boolean;
  track?: AccentTrack;
  className?: string;
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
  "aria-label": ariaLabel = "Summary at a glance",
}: KpiRowProps) {
  const columnClass =
    columns === 6 ? "xl:grid-cols-6" : columns === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4";

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
      <StatStrip {...(sticky ? { sticky: true } : {})} className={columnClass}>
        {tiles.map((tile, index) => {
          const { id, ...tileProps } = tile;
          return <KpiTile key={id ?? `${String(tile.label)}-${index}`} {...tileProps} />;
        })}
      </StatStrip>
    </section>
  );
}
