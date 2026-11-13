"use client";

import type { LotSellerProceedsState } from "@/lib/admin/seller-proceeds/lot-seller-proceeds.vm";
import type { RecordAgreementContext } from "@/lib/admin/seller-proceeds/record-agreement.vm";
import {
  Notice,
  Section,
  SettlementBreakdown,
  Skeleton,
  StaffButton,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import Link from "next/link";
import { useState } from "react";
import { RecordAgreementDialog } from "./record-agreement-dialog";

const NextLink: StaffLinkComponent = Link;

const TITLE = "Seller proceeds";

/**
 * A sold lot's seller side on its Overview: the breakdown as a receipt, what state the sale is in,
 * and the one thing to do next (record the signed agreement, or settle an ATG sale by hand).
 * Every figure comes from the sale's snapshot; this section only lays it out.
 */
export function LotSellerProceedsSection({
  state,
  record = null,
  onMarkSettledOutside,
  initialDialogOpen = false,
}: {
  state: LotSellerProceedsState;
  /** Set when this person may record the seller's signed agreement. */
  record?: RecordAgreementContext | null;
  onMarkSettledOutside?: () => void;
  /** For the review route only. */
  initialDialogOpen?: boolean;
}) {
  const [recording, setRecording] = useState(initialDialogOpen);

  if (state.kind === "none") return null;
  if (state.kind === "loading") {
    return (
      <Section title={TITLE}>
        <div
          aria-busy="true"
          aria-label="Loading the seller's proceeds"
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-6 w-full" />
        </div>
      </Section>
    );
  }
  if (state.kind === "error") {
    return (
      <Section title={TITLE}>
        <div>
          <Notice tone="danger" title="The seller's proceeds could not load">
            Reload the page to try again. The sale itself is not affected.
          </Notice>
        </div>
      </Section>
    );
  }
  if (state.kind === "no_snapshot") {
    return (
      <Section title={TITLE}>
        <p className="text-staff-sm text-staff-muted">{state.message}</p>
      </Section>
    );
  }

  const { breakdown, note, action } = state;
  const actionButton =
    action === "record_agreement" && record ? (
      <StaffButton variant="primary" size="sm" onClick={() => setRecording(true)}>
        Record signed agreement
      </StaffButton>
    ) : action === "mark_settled_outside" && onMarkSettledOutside ? (
      <StaffButton variant="secondary" size="sm" onClick={onMarkSettledOutside}>
        Mark as settled outside LAX
      </StaffButton>
    ) : null;

  return (
    <Section title={TITLE} bodyClassName="p-0">
      {/* The section is the card: the receipt sits in it without a second border. */}
      <SettlementBreakdown
        {...breakdown}
        Link={NextLink}
        note={note}
        action={actionButton}
        className="rounded-none border-0 bg-transparent"
      />
      {record ? (
        <RecordAgreementDialog open={recording} onOpenChange={setRecording} context={record} />
      ) : null}
    </Section>
  );
}
