"use client";

import { manualReviewQueueEyebrow } from "@/lib/admin/compliance-manual-review";
import { manualReviewReasonCopy } from "@/lib/checkout/checkout-payment-errors";
import { formatSettlementsContactLine } from "@/lib/checkout/settlements-contact";
import { dashboardSofRequirementsUrl } from "@/lib/dashboard/dashboard-copy";
import type { ManualReviewReason } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  reason: ManualReviewReason | null;
};

export function ManualReviewBlock({ reason }: Props) {
  const compliance = reason === "aml_hold" || reason === "source_of_funds_required";
  return (
    <output className="block rounded-xl border border-border-hairline bg-surface-container-low/80 px-6 py-8 shadow-sm sm:px-8">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {manualReviewQueueEyebrow(reason)}
      </p>
      <p className="mt-3 font-body text-sm leading-relaxed text-on-surface-variant">
        {manualReviewReasonCopy(reason)}
      </p>
      {reason === "source_of_funds_required" ? (
        <>
          <ul className="mt-4 list-disc space-y-1 pl-5 font-body text-sm text-on-surface-variant">
            <li>Bank statements covering the funds used for this purchase</li>
            <li>Proof of sale or liquidation if proceeds funded the bid</li>
            <li>
              Documentation for inheritance, gift, or corporate treasury sources if applicable
            </li>
          </ul>
          <Button className="mt-6" asChild>
            <Link href={dashboardSofRequirementsUrl()}>View requirements &amp; upload</Link>
          </Button>
        </>
      ) : null}
      <p className="mt-4 break-all font-body text-sm text-on-surface">
        {compliance ? "Support: " : "Settlements: "}
        {formatSettlementsContactLine()}
      </p>
    </output>
  );
}
