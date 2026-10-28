import type { DashboardTileView } from "@/lib/organisation-home/organisation-dashboard-view";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * One figure under "At a glance": label, the figure (a line per currency), one supporting line,
 * and the whole tile a link to the page behind it. With nothing to show it says so plainly.
 * What the figure counts is its accessible description.
 */
export function HomeFigureTile({ tile }: { tile: DashboardTileView }) {
  const descriptionId = `home-tile-${tile.id}-description`;
  return (
    <Link
      href={tile.href}
      aria-describedby={descriptionId}
      data-testid={`home-tile-${tile.id}`}
      className="group flex h-full min-h-11 flex-col gap-1.5 rounded-lg border border-border-hairline bg-surface-container-lowest p-3 text-on-surface transition-colors hover:border-outline-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-4"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-body text-sm text-on-surface-variant">{tile.label}</span>
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          strokeWidth={1.75}
          aria-hidden
        />
      </span>
      {tile.figures.length > 0 ? (
        <span className="font-headline text-xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-2xl">
          {tile.figures.map((figure) => (
            <span key={figure} className="block">
              {figure}
            </span>
          ))}
        </span>
      ) : (
        <span className="font-body text-base font-medium text-on-surface">{tile.emptyText}</span>
      )}
      {tile.supporting.length > 0 ? (
        <span className="mt-auto flex flex-col gap-0.5 pt-1 font-body text-xs text-on-surface-variant">
          {tile.supporting.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ) : null}
      <span id={descriptionId} className="sr-only">
        {tile.description}
      </span>
    </Link>
  );
}
