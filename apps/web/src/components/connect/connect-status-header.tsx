"use client";

import {
  connectGapStageBadgeVariant,
  connectGapStageLabel,
  connectGapStageSummary,
} from "@/lib/connect/connect-gap-copy";
import type { ConnectGapState } from "@auction/connect";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";

const MAX_VISIBLE_MISSING = 5;

type Props = {
  gap: ConnectGapState;
  lastSyncedAt?: Date | null;
};

export function ConnectStatusHeader({ gap, lastSyncedAt }: Props) {
  const visibleMissing = gap.missing.slice(0, MAX_VISIBLE_MISSING);
  const hiddenCount = Math.max(0, gap.missing.length - visibleMissing.length);

  return (
    <Surface variant="section" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant={connectGapStageBadgeVariant(gap.stage)} size="sm">
          {connectGapStageLabel(gap.stage)}
        </StatusBadge>
        {gap.missing.length > 0 ? (
          <span className="font-body text-xs text-on-surface-variant">
            {gap.missing.length} item{gap.missing.length === 1 ? "" : "s"} outstanding
          </span>
        ) : null}
      </div>
      <p className="font-body text-sm text-on-surface-variant">
        {connectGapStageSummary(gap.stage, gap)}
      </p>
      {visibleMissing.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 font-body text-sm text-on-surface-variant">
          {visibleMissing.map((item) => (
            <li key={item.key}>
              <span className="font-medium text-on-surface">{item.label}</span>
              {item.hint ? <span className="text-on-surface-variant"> — {item.hint}</span> : null}
            </li>
          ))}
          {hiddenCount > 0 ? (
            <li className="list-none pl-0 text-xs">and {hiddenCount} more</li>
          ) : null}
        </ul>
      ) : null}
      {lastSyncedAt ? (
        <p className="font-body text-xs text-on-surface-variant">
          Last synced {lastSyncedAt.toLocaleString("en-GB")}
        </p>
      ) : null}
    </Surface>
  );
}
