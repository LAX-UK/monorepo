"use client";

import {
  connectGapActionHint,
  connectGapMissingCountLabel,
  connectGapStageBadgeVariant,
  connectGapStageLabel,
  connectGapStageSummary,
} from "@/lib/connect/connect-gap-copy";
import type { ConnectGapState } from "@auction/connect";
import { presentationToDotStatus } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Surface } from "@auction/ui/components/surface";

const MAX_VISIBLE_MISSING = 5;

type Props = {
  gap: ConnectGapState;
  lastSyncedAt?: Date | null;
  /** Badge + summary only — hide requirement bullets when Stripe banner lists tasks. */
  compact?: boolean;
  /** Finance and other roles who cannot use the embedded onboarding form. */
  readOnly?: boolean;
};

export function ConnectStatusHeader({
  gap,
  lastSyncedAt,
  compact = false,
  readOnly = false,
}: Props) {
  const actionableItems = gap.missing.filter((item) => item.key !== "stripe_disabled");
  const visibleMissing = (actionableItems.length > 0 ? actionableItems : gap.missing).slice(
    0,
    MAX_VISIBLE_MISSING,
  );
  const hiddenCount = Math.max(
    0,
    (actionableItems.length > 0 ? actionableItems : gap.missing).length - visibleMissing.length,
  );
  const countLabel = compact ? null : connectGapMissingCountLabel(gap);
  const actionHint = compact ? null : connectGapActionHint(gap.stage, { readOnly });
  const copyOptions = readOnly ? { readOnly: true as const } : undefined;

  const stagePresentation = presentationToDotStatus({
    label: connectGapStageLabel(gap.stage),
    variant: connectGapStageBadgeVariant(gap.stage),
  });

  return (
    <Surface variant="section" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DotStatusPill label={stagePresentation.label} tone={stagePresentation.tone} />
        {countLabel ? (
          <span className="font-body text-xs text-on-surface-variant">{countLabel}</span>
        ) : null}
      </div>
      <p className="font-body text-sm text-on-surface-variant">
        {connectGapStageSummary(gap.stage, gap, copyOptions)}
      </p>
      {gap.stage === "ready" && !gap.canPublish ? (
        <p className="font-body text-sm text-on-surface-variant">
          Stripe payout setup is complete. Your profile still needs LAX approval before you can
          publish lots or receive settlement transfers.
        </p>
      ) : null}
      {actionHint ? (
        <p className="font-body text-sm text-on-surface-variant">{actionHint}</p>
      ) : null}
      {!compact && visibleMissing.length > 0 ? (
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
