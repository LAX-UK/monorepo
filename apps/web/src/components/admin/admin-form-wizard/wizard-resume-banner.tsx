"use client";

import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { AlertTriangle } from "lucide-react";
import type { WizardDraftPayload } from "./wizard-draft";

type Props = {
  draft: WizardDraftPayload;
  onResume: () => void;
  onDiscard: () => void;
};

export function WizardResumeBanner({ draft, onResume, onDiscard }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-lg border border-warning/40 bg-warning-container/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="font-headline text-sm font-semibold text-on-surface">Draft found</p>
          <p className="mt-0.5 font-body text-sm text-on-surface-variant">
            Resume from step {draft.stepIndex + 1}, saved {formatDateTime(draft.savedAt)}.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:pl-0 pl-8">
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
