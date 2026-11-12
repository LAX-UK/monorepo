"use client";

import { adminRecordBuyerDefaultResultAction } from "@/lib/actions/admin";
import {
  adminLoadReofferPreviewAction,
  adminStartReofferResultAction,
} from "@/lib/actions/admin/admin-reoffers";
import { NO_NEXT_BIDDER_COPY } from "@/lib/admin/reoffer/reoffer-copy";
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
  formatStaffDateTime,
  formatStaffMoney,
  useStaffStepUp,
} from "@auction/staff-ui";
import type { ReofferPreview } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition } from "react";

/** Where the lot goes once its sale is cancelled. */
export type BuyerDefaultOutcomeChoice = "returned_to_inventory" | "offered_to_underbidder";

/** Who the second option would offer the lot to: read when the dialog opens. */
export type NextBidderState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; preview: ReofferPreview };

const RETURN_OPTION = {
  value: "returned_to_inventory",
  label: "Return to inventory",
  description:
    "The lot goes back to draft at its starting price. Its bid history is kept, marked as not winning.",
} as const;

/** The next bidder in a quiet box under the option, so staff see who they would be offering to. */
function NextBidderLine({ preview }: { preview: ReofferPreview }) {
  const { next } = preview;
  if (!next) return null;
  return (
    <span
      className="mt-2 flex flex-col gap-0.5 rounded-staff-md border border-staff-line-subtle bg-staff-sunken px-3 py-2 text-staff-xs text-staff-muted"
      data-testid="next-bidder"
    >
      <span>
        <span className="font-medium text-staff-fg">{next.accountName ?? "The next bidder"}</span>
        {" · their bid "}
        {formatStaffMoney(next.bidMinor)} on {formatStaffDateTime(next.placedAt)}
      </span>
      {next.belowReserve ? <span>Their bid is below the reserve.</span> : null}
      {next.othersAfter > 0 ? (
        <span>
          {next.othersAfter} other {next.othersAfter === 1 ? "bidder" : "bidders"} after them
        </span>
      ) : null}
    </span>
  );
}

function offerOption(next: NextBidderState): {
  label: string;
  description: string;
  disabled: boolean;
  detail: React.ReactNode;
} {
  const label = "Offer to the next bidder";
  if (next.status === "loading") {
    return { label, description: "Checking who bid next…", disabled: true, detail: null };
  }
  if (next.status === "ready" && !next.preview.next) {
    const reason = next.preview.noneReason ?? "no_other_bidder";
    return { label, description: NO_NEXT_BIDDER_COPY[reason], disabled: true, detail: null };
  }
  return {
    label,
    description:
      "Asks the seller first, then offers the lot to the next bidder at their own bid. You send the offer once the seller agrees.",
    disabled: false,
    detail: next.status === "ready" ? <NextBidderLine preview={next.preview} /> : null,
  };
}

export type BuyerDefaultDialogViewProps = {
  open: boolean;
  lotTitle: string;
  busy: boolean;
  /** The API's refusal, kept in the dialog with what was typed. */
  failure: string | null;
  outcome: BuyerDefaultOutcomeChoice;
  restrict: boolean;
  nextBidder: NextBidderState;
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
      description="Use this when the buyer has not paid and the sale is being cancelled. The invoice is voided and kept on record, and no seller payout is made."
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
          {[
            RETURN_OPTION,
            { ...offerOption(props.nextBidder), value: "offered_to_underbidder" as const },
          ].map((option) => {
            const id = `${radioName}-${option.value}`;
            const disabled = busy || ("disabled" in option && option.disabled);
            return (
              <ChoiceRow
                key={option.value}
                htmlFor={id}
                label={option.label}
                description={
                  <>
                    {option.description}
                    {"detail" in option ? option.detail : null}
                  </>
                }
                disabled={disabled}
                control={<StaffRadio id={id} value={option.value} disabled={disabled} />}
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
 * or starts an offer to the next bidder, which asks the seller first. Staff may also pause the
 * buyer's bidding. The reason is required and audited; a refusal from the API (paid, held for
 * checks) stays in the dialog. The next bidder is read when the dialog opens.
 */
export function useBuyerDefaultDialog() {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [outcome, setOutcome] = useState<BuyerDefaultOutcomeChoice>("returned_to_inventory");
  const [restrict, setRestrict] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [nextBidder, setNextBidder] = useState<NextBidderState>({ status: "loading" });
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const open = useCallback((next: Target) => {
    setOutcome("returned_to_inventory");
    setRestrict(false);
    setFailure(null);
    setNextBidder({ status: "loading" });
    setTarget(next);
    void adminLoadReofferPreviewAction(next.id).then((result) =>
      setNextBidder(
        result.ok && result.data ? { status: "ready", preview: result.data } : { status: "failed" },
      ),
    );
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
      if (!result.ok) {
        if (stepUp.handle(result, "record a buyer default")) {
          close();
          return;
        }
        setFailure(result.error);
        return;
      }
      close();
      if (outcome === "offered_to_underbidder") {
        await startOffer(current);
      } else {
        notify.success(`Buyer default recorded for ${current.title}`, {
          description: "The buyer and the seller have been told.",
        });
      }
      router.refresh();
    });
  };

  /** The default is recorded; if the offer cannot start, the lot page offers it again. */
  const startOffer = async (current: Target) => {
    const started = await adminStartReofferResultAction(current.id);
    if (started.ok) {
      const asked = started.data?.status !== "ready";
      notify.success(
        asked
          ? "Re-offer started: the seller has been asked"
          : "Re-offer started: it is ready to send",
        {
          description: `Buyer default recorded for ${current.title}.`,
        },
      );
      return;
    }
    notify.error("Buyer default recorded, but the offer did not start", {
      description: `${started.error} Start it from the lot page.`,
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
        nextBidder={nextBidder}
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
