"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  SELLER_SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_HINTS,
} from "@/lib/marketing/sell-flow-copy";
import type { ItemSubmissionStatus } from "@auction/types";
import Link from "next/link";

/** Statuses highlighted in the list-page glossary (most common seller questions). */
const GUIDE_STATUSES = [
  "submitted",
  "approved",
  "converted",
] as const satisfies readonly ItemSubmissionStatus[];

/** Collapsible status glossary for the submissions list (progressive disclosure). */
export function SubmissionStatusGuide() {
  return (
    <CollapsibleSection title="What do these statuses mean?">
      <div className="space-y-3 px-4 pb-4">
        <ul className="space-y-2">
          {GUIDE_STATUSES.map((status) => {
            const hint = SUBMISSION_STATUS_HINTS[status];
            if (!hint) return null;

            return (
              <li key={status} className="font-body text-sm text-on-surface-variant">
                <span className="font-medium text-on-surface">
                  {SELLER_SUBMISSION_STATUS_LABELS[status]}
                </span>
                {" — "}
                {hint}
              </li>
            );
          })}
        </ul>
        <p className="font-body text-xs text-on-surface-variant">
          Full policy in{" "}
          <Link href="/sell" className="text-primary underline-offset-4 hover:underline">
            Selling with LAX
          </Link>
          .
        </p>
      </div>
    </CollapsibleSection>
  );
}
