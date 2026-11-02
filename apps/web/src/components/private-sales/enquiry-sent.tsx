"use client";

import { nextSteps, replyByLabel } from "@/lib/private-sales/enquiry-sent";
import { departmentOptions } from "@/lib/private-sales/enquiry-values";
import type { EnquiryPath } from "@/lib/private-sales/enquiry-values";
import { MarketingEnquiryConfirmation } from "@auction/marketing-ui";
import { Button, ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useRef } from "react";

export type SentReceipt = {
  reference: string;
  replyBy: string;
  path: EnquiryPath;
  email: string;
  departmentSlug: string;
};

/**
 * The form's place once the enquiry is stored: the reference to quote, the day a reply is
 * promised, and what happens next. Focus lands on it, so a screen reader reads it straight away.
 */
export function EnquirySent({
  receipt,
  onAnother,
}: {
  receipt: SentReceipt;
  onAnother: () => void;
}) {
  const ref = useRef<HTMLOutputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const department = departmentOptions().find((o) => o.value === receipt.departmentSlug)?.label;
  const replyBy = receipt.replyBy ? replyByLabel(receipt.replyBy) : "two business days from now";
  return (
    <div
      className="scroll-mt-28 rounded-lax-card border border-lax-line bg-lax-surface p-4 shadow-lax-xs sm:p-6"
      id="enquiry"
    >
      <MarketingEnquiryConfirmation
        ref={ref}
        data-testid="private-sale-enquiry-sent"
        title="We have your enquiry"
        lead={`We've emailed a copy to ${receipt.email}.`}
        reference={receipt.reference || null}
        steps={nextSteps(receipt.path, { departmentLabel: department, replyBy }).map((step) => ({
          title: step.lead,
          body: step.rest.trim(),
        }))}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onAnother}>
              Send another enquiry
            </Button>
            <ButtonLink Link={Link} href="/sell" variant="ghost">
              Back to Sell
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
