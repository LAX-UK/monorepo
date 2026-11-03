"use client";

import { adminRecordBuyerDefaultResultAction } from "@/lib/actions/admin";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceFieldset,
  ChoiceRow,
  ConfirmActionDialog,
  Notice,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  useStaffStepUp,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition } from "react";

/** Where the lot goes once its sale is cancelled. */
export type BuyerDefaultOutcomeChoice = "returned_to_inventory" | "offered_to_underbidder";

const OUTCOMES: { value: BuyerDefaultOutcomeChoice; label: string; description: string }[] = [
  {
    value: "returned_to_inventory",
    label: "Return to inventory",
    description:
      "The lot goes back to draft at its starting price. Its bid history is kept, marked as not winning.",
  },
  {
    value: "offered_to_underbidder",
    label: "Offer to the underbidder",
    description:
      "Records the offer and tells the next bidder the lot may become available. The seller is asked before it is sold on.",
  },
];

export type BuyerDefaultDialogViewProps = {
  open: boolean;
  lotTitle: string;
  busy: boolean;
  /** The API's refusal, kept in the dialog with what was typed. */
  failure: string | null;
  outcome: BuyerDefaultOutcomeChoice;
  restrict: boolean;
  onOutcomeChange: (outcome: BuyerDefaultOutcomeChoice) => void;
  onRestrictChange: (restrict: boolean) => void;
  onConfirm: (details: { reason: string }) => void;
  onOpenChange: (open: boolean) => void;
};

/** The dialog itself, with no data fetching: the hook below drives it. */
export function BuyerDefaultDialog(props: BuyerDefaultDialogViewProps) {
  const radioName = useId();
  const restrictId = useId();
  const { busy } = props;
  return (
    <ConfirmActionDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Record a buyer default for ${props.lotTitle}?`}
      description="Use this when the buyer has not paid and the sale is being cancelled. The invoice is voided and kept on record, no seller payout is made, and no fees or interest are added."
      confirmLabel="Record buyer default"
      tone="danger"
      loading={busy}
      onConfirm={props.onConfirm}
      reason={{
        label: "Reason",
        description: "Kept in the audit log and with the lot.",
        maxLength: 1000,
        placeholder: "For example: no payment after two reminders and no reply from the buyer.",
      }}
    >
      {props.failure ? (
        <Notice tone="danger" alert title="That did not go through">
          {props.failure}
        </Notice>
      ) : null}
      <ChoiceFieldset legend="What happens to the lot?" disabled={busy}>
        <StaffRadioGroup
          name={radioName}
          value={props.outcome}
          onValueChange={(value) => props.onOutcomeChange(value as BuyerDefaultOutcomeChoice)}
        >
          {OUTCOMES.map((option) => {
            const id = `${radioName}-${option.value}`;
            return (
              <ChoiceRow
                key={option.value}
                htmlFor={id}
                label={option.label}
                description={option.description}
                disabled={busy}
                control={<StaffRadio id={id} value={option.value} disabled={busy} />}
              />
            );
          })}
        </StaffRadioGroup>
      </ChoiceFieldset>
      <ChoiceRow
        htmlFor={restrictId}
        label="Pause the buyer's bidding"
        description="Suspends their account until staff lift it. The buyer is told."
        disabled={busy}
        control={
          <StaffCheckbox
            id={restrictId}
            checked={props.restrict}
            disabled={busy}
            onCheckedChange={(on) => props.onRestrictChange(on === true)}
          />
        }
      />
    </ConfirmActionDialog>
  );
}

type Target = { id: string; title: string };

/**
 * The Buyer default action on an ended lot with a winner: voids the unpaid invoice (kept on
 * record), cancels the sale, tells the buyer and the seller, and sends the lot back to inventory
 * or on to the underbidder. Staff may also pause the buyer's bidding. The reason is required and
 * audited; a refusal from the API (paid, held for checks, no underbidder) stays in the dialog.
 */
export function useBuyerDefaultDialog() {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [outcome, setOutcome] = useState<BuyerDefaultOutcomeChoice>("returned_to_inventory");
  const [restrict, setRestrict] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const open = useCallback((next: Target) => {
    setOutcome("returned_to_inventory");
    setRestrict(false);
    setFailure(null);
    setTarget(next);
  }, []);

  const close = () => {
    setFailure(null);
    setTarget(null);
  };

  const confirm = ({ reason }: { reason: string }) => {
    const current = target;
    if (!current) return;
    setFailure(null);
    startTransition(async () => {
      const result = await adminRecordBuyerDefaultResultAction(current.id, {
        outcome,
        reason,
        restrictBidding: restrict,
      });
      if (result.ok) {
        close();
        notify.success(`Buyer default recorded for ${current.title}`, {
          description: "The buyer and the seller have been told.",
        });
        router.refresh();
        return;
      }
      if (stepUp.handle(result, "record a buyer default")) {
        close();
        return;
      }
      setFailure(result.error);
    });
  };

  const dialog = (
    <>
      <BuyerDefaultDialog
        open={target !== null}
        lotTitle={target?.title ?? "this lot"}
        busy={busy}
        failure={failure}
        outcome={outcome}
        restrict={restrict}
        onOutcomeChange={setOutcome}
        onRestrictChange={setRestrict}
        onConfirm={confirm}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
      />
      {stepUp.dialog}
    </>
  );

  return { open, dialog };
}
