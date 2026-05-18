import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Sparkline } from "./sparkline.js";

export type KpiTileTone = "primary" | "lot-orange" | "live-red" | "secondary";

/** Semantic emphasis for dashboard KPI rows (v3). */
export type KpiTileSemanticTone = "default" | "emphasis" | "warning" | "danger";

export type KpiTileProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. "+12%" or "▲ 3" */
  delta?: React.ReactNode;
  deltaTone?: "positive" | "negative" | "neutral";
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
};

const deltaToneClass = {
  positive: "text-lot-orange dark:text-emerald-400",
  negative: "text-live-red",
  neutral: "text-on-surface-variant",
} as const;

const semanticToneClass: Record<KpiTileSemanticTone, string> = {
  default: "border-border-hairline bg-surface-container-lowest",
  emphasis: "border-primary/30 bg-primary-container/10",
  warning: "border-lot-orange/35 bg-lot-orange/5",
  danger: "border-live-red/35 bg-live-red/5",
};

export function KpiTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  trend,
  trendTone = "primary",
  trendSlot,
  icon,
  className,
  emphasize,
  semanticTone = "default",
}: KpiTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-4 sm:p-5",
        semanticToneClass[semanticTone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-label text-xs font-normal uppercase tracking-widest text-secondary">
          {label}
        </p>
        {icon ? <div className="text-primary [&_svg]:size-5">{icon}</div> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-headline text-3xl tabular-nums text-on-surface",
              emphasize && "border-b-2 border-primary pb-0.5",
            )}
          >
            {value}
          </p>
          {delta ? (
            <p className={cn("mt-1 font-label text-xs font-semibold", deltaToneClass[deltaTone])}>
              {delta}
            </p>
          ) : null}
        </div>
        {trend && trend.length > 0 ? (
          <Sparkline values={trend} tone={trendTone} width={72} height={28} />
        ) : null}
        {trendSlot ? <div className="shrink-0">{trendSlot}</div> : null}
      </div>
    </div>
  );
}
