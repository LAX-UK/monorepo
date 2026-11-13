"use client";

import {
  type LotSellerProceedsState,
  RECORD_AGREEMENT_BUTTON_ID,
} from "@/lib/admin/seller-proceeds/lot-seller-proceeds.vm";
import { markSettledOutsideAction } from "@/lib/admin/seller-proceeds/record-agreement.actions";
import type { RecordAgreementContext } from "@/lib/admin/seller-proceeds/record-agreement.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import {
  ConfirmActionDialog,
  Notice,
  Section,
  SettlementBreakdown,
  Skeleton,
  StaffButton,
  type StaffLinkComponent,
  TextLink,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  lotId = null,
  canSettleOutside = false,
  replace = null,
  agreementDocumentHref = null,
}: {
  state: LotSellerProceedsState;
  lotId?: string | null;
  /**
   * Set when this person may record the seller's signed agreement; the section then points to
   * the button in the lot header's held notice.
   */
  record?: RecordAgreementContext | null;
  /** May this person mark an ATG sale as settled outside LAX. */
  canSettleOutside?: boolean;
  /** Set for an Administrator: the agreement on record can be replaced with a corrected one. */
  replace?: RecordAgreementContext | null;
  /** Opens the signed agreement PDF on record, for those who may handle agreements. */
  agreementDocumentHref?: string | null;
}) {
  const [settling, setSettling] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  if (state.kind === "none") return null;
  if (state.kind === "loading") {
    return (
      <Section title={TITLE}>
        <output
          aria-busy="true"
          aria-label="Loading the seller's proceeds"
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-6 w-full" />
        </output>
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
  // A held sale is recorded from the one button in the lot header's notice; this points to it.
  const actionButton =
    action === "record_agreement" && record ? (
      <p className="text-staff-sm text-staff-muted">
        <TextLink href={`#${RECORD_AGREEMENT_BUTTON_ID}`}>Record the signed agreement</TextLink>{" "}
        from the notice at the top of this page.
      </p>
    ) : action === "mark_settled_outside" && canSettleOutside ? (
      <StaffButton variant="secondary" size="sm" onClick={() => setSettling(true)}>
        Mark as settled outside LAX
      </StaffButton>
    ) : replace ? (
      <StaffButton variant="ghost" size="sm" onClick={() => setReplacing(true)}>
        Replace with a corrected agreement
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
      {agreementDocumentHref ? (
        <p className="border-t border-staff-line-subtle px-4 py-3 text-staff-sm">
          <TextLink href={agreementDocumentHref} external>
            Open signed agreement
          </TextLink>{" "}
          <span className="text-staff-muted">PDF</span>
        </p>
      ) : null}
      {replace ? (
        <RecordAgreementDialog
          open={replacing}
          onOpenChange={setReplacing}
          context={replace}
          replace
        />
      ) : null}
      {canSettleOutside && lotId ? (
        <ConfirmActionDialog
          open={settling}
          onOpenChange={(open) => {
            if (!saving) setSettling(open);
          }}
          title="Mark this ATG sale as settled outside LAX?"
          description="Do this once the seller has been paid by hand under the ATG settlement runbook. LAX will not pay this sale."
          confirmLabel="Mark as settled"
          cancelLabel="Not now"
          loading={saving}
          reason={{
            label: "How it was settled",
            description: "Kept in the audit log.",
            minLength: 10,
          }}
          onConfirm={({ reason }) =>
            startSaving(async () => {
              const result = await markSettledOutsideAction({ lotId, reason });
              if (result.ok) {
                toast.success("Marked as settled outside LAX.");
                setSettling(false);
                router.refresh();
              } else if (!handleStaffStepUp(result)) {
                toast.error(result.error);
              }
            })
          }
        />
      ) : null}
    </Section>
  );
}
