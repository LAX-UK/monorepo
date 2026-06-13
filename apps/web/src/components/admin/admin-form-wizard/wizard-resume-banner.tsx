"use client";

import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import type { WizardDraftPayload } from "./wizard-draft";

type Props = {
  draft: WizardDraftPayload;
  onResume: () => void;
  onDiscard: () => void;
};

export function WizardResumeBanner({ draft, onResume, onDiscard }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-label text-xs font-semibold uppercase tracking-wide text-secondary">
          Draft found
        </p>
        <p className="font-body text-sm text-on-surface-variant">
          Resume from step {draft.stepIndex + 1}, saved {formatDateTime(draft.savedAt)}.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <Button type="button" size="sm" onClick={onResume}>
          Resume draft
        </Button>
      </div>
    </div>
  );
}
