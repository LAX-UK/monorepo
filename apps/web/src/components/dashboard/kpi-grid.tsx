import { KpiTile, type KpiTileProps, cn } from "@auction/ui";

type KpiGridProps = {
  tiles: readonly KpiTileProps[];
  columns?: 4 | 6;
  className?: string;
};

export function KpiGrid({ tiles, columns = 4, className }: KpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        columns === 6 ? "lg:grid-cols-3 xl:grid-cols-6" : "xl:grid-cols-4",
        className,
      )}
    >
      {tiles.map((tile, index) => (
        <KpiTile key={`${String(tile.label)}-${index}`} {...tile} />
      ))}
    </div>
  );
}
