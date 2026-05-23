"use client";

import type { LotCatalogueProfile } from "@/lib/admin/lot-catalogue";
import { Button } from "@auction/ui/components/button";

type Props = {
  profile: LotCatalogueProfile;
  onEditLotType?: (() => void) | undefined;
};

export function LotTypeSummaryBanner({ profile, onEditLotType }: Props) {
  return (
    <div className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-body text-sm text-on-surface">
            <span className="font-medium">{profile.label}</span>
            <span className="text-on-surface-variant"> — {profile.summary}</span>
          </p>
          <p className="font-body text-xs text-on-surface-variant">
            Pricing and bidding fields below match this lot type.
          </p>
        </div>
        {onEditLotType ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 font-body text-xs"
            onClick={onEditLotType}
          >
            Change type
          </Button>
        ) : null}
      </div>
    </div>
  );
}
