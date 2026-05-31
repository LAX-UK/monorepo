import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Sparkline } from "./sparkline.js";

export type KpiTileTone = "primary" | "lot-orange" | "live-red" | "secondary";

/** Semantic emphasis for dashboard KPI rows (v3). */
export type KpiTileSemanticTone = "default" | "emphasis" | "warning" | "danger";

export type KpiDeltaDirection = "up" | "down" | "flat";

export type KpiTileProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. "+12%" or "▲ 3" */
  delta?: React.ReactNode;
  deltaTone?: "positive" | "negative" | "neutral";
  /** Structured delta — renders arrow + percent when `delta` is omitted */
  deltaDirection?: KpiDeltaDirection;
  deltaPercent?: string;
  /** e.g. "vs 7 days ago" */
  compareHint?: string;
  /** Short callout shown in corner when value is outside normal range */
  anomaly?: string;
  /** 0–1 series for optional sparkline */
  trend?: readonly number[];
  trendTone?: KpiTileTone;
  /** Optional slot below value (sparkline, link, custom trend UI). */
  trendSlot?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  /** Accent underline on value row */
  emphasize?: boolean;
  /** Dashboard hierarchy tone — hairline accent, no extra shadow on tile. */
  semanticTone?: KpiTileSemanticTone;
  /** Hover lift when tile is interactive */
  clickable?: boolean;
};

const deltaToneClass = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-neutral-delta",
} as const;

const deltaArrow: Record<KpiDeltaDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "—",
};

const semanticToneClass: Record<KpiTileSemanticTone, string> = {
  default: "border-border-hairline bg-surface-container-lowest",
  emphasis: "border-primary/30 bg-primary-container/10",
  warning: "border-lot-orange/35 bg-lot-orange/5",
  danger: "border-live-red/35 bg-live-red/5",
};

function formatStructuredDelta(
  direction: KpiDeltaDirection,
  percent: string | undefined,
  tone: "positive" | "negative" | "neutral",
): React.ReactNode {
  const arrow = deltaArrow[direction];
  const text = percent ? `${arrow} ${percent}` : arrow;
  return (
    <span className={cn("font-label text-xs font-semibold tabular-nums", deltaToneClass[tone])}>
      {text}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  deltaDirection,
  deltaPercent,
  compareHint,
  anomaly,
  trend,
  trendTone = "primary",
  trendSlot,
  icon,
  className,
  emphasize,
  semanticTone = "default",
  clickable = false,
}: KpiTileProps) {
  const resolvedDelta =
    delta ??
    (deltaDirection ? formatStructuredDelta(deltaDirection, deltaPercent, deltaTone) : null);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[8.5rem] min-w-0 flex-col overflow-hidden rounded-xl border p-4 transition-shadow motion-safe:duration-200 sm:p-5",
        semanticToneClass[semanticTone],
        clickable &&
          "cursor-pointer hover:shadow-[var(--shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {anomaly ? (
        <span className="absolute right-3 top-3 max-w-[40%] truncate rounded-full bg-warning-container px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wide text-warning">
          {anomaly}
        </span>
      ) : null}
      <KpiTileHeader label={label} icon={icon} />
      <KpiTileBody
        value={value}
        {...(emphasize !== undefined ? { emphasize } : {})}
        resolvedDelta={resolvedDelta}
        {...(compareHint !== undefined ? { compareHint } : {})}
        {...(trend !== undefined ? { trend } : {})}
        trendTone={trendTone}
        {...(trendSlot !== undefined ? { trendSlot } : {})}
      />
    </div>
  );
}

function KpiTileHeader({ label, icon }: { label: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <p className="min-w-0 truncate font-label text-xs font-normal uppercase tracking-widest text-secondary">
        {label}
      </p>
      {icon ? <div className="shrink-0 text-primary [&_svg]:size-5">{icon}</div> : null}
    </div>
  );
}

function KpiTileBody({
  value,
  emphasize,
  resolvedDelta,
  compareHint,
  trend,
  trendTone,
  trendSlot,
}: {
  value: React.ReactNode;
  emphasize?: boolean;
  resolvedDelta: React.ReactNode;
  compareHint?: string;
  trend?: readonly number[];
  trendTone: KpiTileTone;
  trendSlot?: React.ReactNode;
}) {
  const valueTitle = typeof value === "string" ? value : undefined;

  const hasTrendSlot = Boolean(trendSlot);
  const showSparkline = Boolean(trend && trend.length > 0);

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="flex min-w-0 items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-headline text-xl font-bold tabular-nums text-on-surface sm:text-2xl lg:text-[length:var(--text-display-kpi,2.25rem)]",
              emphasize && "border-b-2 border-primary pb-0.5",
            )}
            style={{ fontFeatureSettings: "var(--font-feature-tabular)" }}
            {...(valueTitle ? { title: valueTitle } : {})}
          >
            {value}
          </p>
        </div>
        {hasTrendSlot ? (
          <div className="shrink-0">{trendSlot}</div>
        ) : (
          <div className="h-7 w-[72px] shrink-0" aria-hidden={!showSparkline}>
            {showSparkline && trend ? (
              <Sparkline values={trend} tone={trendTone} width={72} height={28} />
            ) : null}
          </div>
        )}
      </div>
      <div className="mt-auto min-h-[2.75rem] pt-1">
        {resolvedDelta ? <div className="min-w-0 truncate">{resolvedDelta}</div> : null}
        {compareHint ? (
          <p className="line-clamp-2 font-body text-[10px] text-on-surface-variant">
            {compareHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
