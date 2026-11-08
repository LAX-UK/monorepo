"use client";

import {
  adminAddPayoutAdjustmentResultAction,
  adminAdoptBlockedPayoutTransferResultAction,
  adminMarkPayoutPaidResultAction,
  adminReleaseBlockedPayoutResultAction,
  adminRetryPayoutTransferResultAction,
  adminReversePayoutResultAction,
} from "@/lib/actions/admin/admin-payouts";
import { payoutReversalConfirmationPhrase } from "@/lib/admin/finance/payout-settlement.vm";
import { type PayoutsStaffRow, parseSignedPounds } from "@/lib/admin/finance/payouts-staff-list.vm";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  Field,
  KeyValueList,
  Notice,
  type OverflowAction,
  StaffCheckbox,
  TextInput,
  formatStaffMoney,
  useStaffStepUp,
} from "@auction/staff-ui";
import { PAYOUT_ACTION_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Pending = {
  kind: "mark-paid" | "adjust" | "reverse" | "retry" | "adopt" | "release";
  payout: PayoutsStaffRow;
  /** One key per dialog, so a double click repeats one request. */
  idempotencyKey: string;
} | null;

/** The API asks for at least this many characters of reason on every payout money action. */
const REASON_MIN = PAYOUT_ACTION_REASON_MIN;

function PayoutFacts({ payout }: { payout: PayoutsStaffRow }) {
  return (
    <div className="rounded-staff-lg border border-staff-line px-3 py-1">
      <KeyValueList
        items={[
          { label: "Seller", value: payout.seller },
          { label: "Period", value: payout.period },
          { label: "Net amount", value: payout.net, numeric: true },
        ]}
      />
    </div>
  );
}

/**
 * Mark paid, add adjustment, retry a failed transfer, resolve a blocked payout (adopt the Stripe
 * transfer or release it for a retry) and reverse for a payout, from a row's `…` menu or the record panel.
 * Each opens a confirm dialog that names the amount and the seller. An adjustment and a reversal
 * ask for a reason that is kept with the payout; a reversal also asks for the payout's reference
 * to be typed. When the API asks for a fresh sign-in, the step-up dialog takes over.
 */
export function usePayoutMoneyActions({
  canProcess,
  canReverse,
}: {
  canProcess: boolean;
  canReverse: boolean;
}) {
  const router = useRouter();
  const [pending, setPendingState] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [transferId, setTransferId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [noLiveTransfer, setNoLiveTransfer] = useState(false);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const open = useCallback((kind: NonNullable<Pending>["kind"], payout: PayoutsStaffRow) => {
    setFailure(null);
    setTransferId(payout.stripeTransferId ?? "");
    setAmountText("");
    setNoLiveTransfer(false);
    setPendingState({ kind, payout, idempotencyKey: crypto.randomUUID() });
  }, []);
  const close = useCallback(() => {
    setFailure(null);
    setPendingState(null);
  }, []);

  const actionsFor = useCallback(
    (payout: PayoutsStaffRow): OverflowAction[] => {
      const actions: OverflowAction[] = [];
      if (canProcess) {
        actions.push(
          {
            id: "mark-paid",
            label: `Mark ${payout.net} paid`,
            onSelect: () => open("mark-paid", payout),
            ...(payout.canMarkPaid
              ? {}
              : { disabledReason: "Only scheduled or in-transit payouts can be marked paid" }),
          },
          {
            id: "adjust",
            label: "Add adjustment",
            onSelect: () => open("adjust", payout),
            ...(payout.canAdjust
              ? {}
              : { disabledReason: "Adjustments close once a payout is paid or has failed" }),
          },
        );
      }
      if (canProcess && payout.canRetryTransfer) {
        actions.push({
          id: "retry",
          label: "Retry transfer",
          onSelect: () => open("retry", payout),
        });
      }
      if (canProcess && payout.canResolveBlocked) {
        actions.push(
          {
            id: "adopt",
            label: "Adopt Stripe transfer",
            onSelect: () => open("adopt", payout),
          },
          {
            id: "release",
            label: "Release for retry",
            onSelect: () => open("release", payout),
          },
        );
      }
      if (canReverse) {
        actions.push({
          id: "reverse",
          label: `Reverse ${payout.net}`,
          tone: "danger",
          onSelect: () => open("reverse", payout),
          ...(payout.canReverse
            ? {}
            : { disabledReason: "Reversal opens once a payout is in transit or paid" }),
        });
      }
      return actions;
    },
    [canProcess, canReverse, open],
  );

  const run = (
    call: () => Promise<
      { ok: true } | { ok: false; error: string; errorCode?: string | undefined }
    >,
    stepUpLabel: string,
    done: string,
  ) => {
    setFailure(null);
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        close();
        notify.success(done);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, stepUpLabel)) {
        close();
        return;
      }
      // The dialog stays open with what was typed, so the person can fix it or cancel.
      setFailure(result.error);
    });
  };

  const failureNotice = (verb: string) =>
    failure ? (
      <Notice tone="danger" alert title={`The ${verb} did not go through`}>
        {failure}
      </Notice>
    ) : null;

  const adjustment = parseSignedPounds(amountText);
  const adjustmentLabel = adjustment.ok
    ? `Add ${formatStaffMoney(adjustment.pence)}`
    : "Add adjustment";

  const dialogs = (
    <>
      <ConfirmActionDialog
        open={pending?.kind === "mark-paid"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending ? `Mark ${pending.payout.net} as paid to ${pending.payout.seller}?` : "Mark paid"
        }
        description="Records this payout as paid against the Stripe transfer below. Check the transfer ID first. This cannot be undone."
        confirmLabel={pending ? `Mark ${pending.payout.net} paid` : "Mark paid"}
        loading={busy}
        onConfirm={() => {
          if (pending?.kind !== "mark-paid") return;
          const { payout, idempotencyKey } = pending;
          if (!transferId.trim()) {
            setFailure("Enter the Stripe transfer ID.");
            return;
          }
          run(
            () =>
              adminMarkPayoutPaidResultAction(payout.id, {
                stripeTransferId: transferId,
                idempotencyKey,
              }),
            `mark ${payout.net} as paid`,
            `Marked ${payout.net} as paid to ${payout.seller}`,
          );
        }}
      >
        {pending?.kind === "mark-paid" ? (
          <>
            {failureNotice("update")}
            <PayoutFacts payout={pending.payout} />
            <Field label="Stripe transfer ID">
              <TextInput
                value={transferId}
                placeholder="tr_…"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setTransferId(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "adjust"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending
            ? `Adjust the ${pending.payout.net} payout to ${pending.payout.seller}?`
            : "Add adjustment"
        }
        description="Adds a line that changes the payout's gross and net totals while it is still open. Use a minus sign to take money off."
        confirmLabel={adjustmentLabel}
        loading={busy}
        reason={{
          label: "Reason for the adjustment",
          description: "Kept with the payout and in the audit log.",
          minLength: REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          if (pending?.kind !== "adjust") return;
          const { payout, idempotencyKey } = pending;
          if (!adjustment.ok) {
            setFailure("Enter an amount in pounds, such as -25.00 or 40.00.");
            return;
          }
          run(
            () =>
              adminAddPayoutAdjustmentResultAction(payout.id, {
                amount: adjustment.amount,
                note: reason,
                idempotencyKey,
              }),
            `add ${formatStaffMoney(adjustment.pence)} to this payout`,
            `Added ${formatStaffMoney(adjustment.pence)} to the payout for ${payout.seller}`,
          );
        }}
      >
        {pending?.kind === "adjust" ? (
          <>
            {failureNotice("adjustment")}
            <PayoutFacts payout={pending.payout} />
            <Field label="Adjustment amount" description="For example -25.00 or 40.00.">
              <TextInput
                value={amountText}
                inputMode="decimal"
                autoComplete="off"
                leading={<span className="text-staff-muted">£</span>}
                className="tabular-nums"
                onChange={(event) => setAmountText(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "retry"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending
            ? `Retry the ${pending.payout.net} transfer to ${pending.payout.seller}?`
            : "Retry transfer"
        }
        description="Sends the Stripe transfer again. If Stripe accepts it the payout moves to in transit; if not, it stays failed with the new reason. Retrying the same failure twice cannot send the money twice."
        confirmLabel={pending ? `Retry ${pending.payout.net} transfer` : "Retry transfer"}
        loading={busy}
        onConfirm={() => {
          if (pending?.kind !== "retry") return;
          const { payout, idempotencyKey } = pending;
          run(
            () => adminRetryPayoutTransferResultAction(payout.id, { idempotencyKey }),
            `retry the ${payout.net} transfer to ${payout.seller}`,
            `Sent the ${payout.net} transfer to ${payout.seller} again`,
          );
        }}
      >
        {pending?.kind === "retry" ? (
          <>
            {failureNotice("retry")}
            <PayoutFacts payout={pending.payout} />
            {pending.payout.failureReason ? (
              <Notice tone="danger" title="Why it failed">
                {pending.payout.failureReason}
              </Notice>
            ) : null}
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "adopt"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending
            ? `Adopt a Stripe transfer for the ${pending.payout.net} payout to ${pending.payout.seller}?`
            : "Adopt Stripe transfer"
        }
        description="Use this when Stripe already holds the transfer that pays this seller. Stripe is asked for it and it is accepted only if it went to this seller's account, in this currency, for exactly the net amount, is not reversed, and is not linked to another payout. The payout then moves to in transit."
        confirmLabel={pending ? `Adopt for ${pending.payout.net} payout` : "Adopt transfer"}
        loading={busy}
        reason={{
          label: "Reason for adopting this transfer",
          description: "What you checked in Stripe. Kept in the audit log with your name.",
          minLength: REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          if (pending?.kind !== "adopt") return;
          const { payout, idempotencyKey } = pending;
          if (!transferId.trim()) {
            setFailure("Enter the Stripe transfer ID.");
            return;
          }
          run(
            () =>
              adminAdoptBlockedPayoutTransferResultAction(payout.id, {
                stripeTransferId: transferId,
                reason,
                idempotencyKey,
              }),
            `adopt a transfer for the ${payout.net} payout to ${payout.seller}`,
            `Adopted the Stripe transfer for the ${payout.net} payout to ${payout.seller}`,
          );
        }}
      >
        {pending?.kind === "adopt" ? (
          <>
            {failureNotice("adoption")}
            <PayoutFacts payout={pending.payout} />
            {pending.payout.failureReason ? (
              <Notice tone="warning" title="Why it is blocked">
                {pending.payout.failureReason}
              </Notice>
            ) : null}
            <Field label="Stripe transfer ID">
              <TextInput
                value={transferId}
                placeholder="tr_…"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setTransferId(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "release"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending
            ? `Release the ${pending.payout.net} payout to ${pending.payout.seller} for a retry?`
            : "Release for retry"
        }
        description="Moves the payout from blocked to failed so the transfer can be retried. Only do this once you have checked in Stripe that no live transfer exists for it: a retry that finds one is blocked again, but a missed one risks paying the seller twice."
        confirmLabel={pending ? `Release ${pending.payout.net} payout` : "Release payout"}
        tone="danger"
        loading={busy}
        reason={{
          label: "Reason for releasing it",
          description: "What you checked in Stripe. Kept in the audit log with your name.",
          minLength: REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          if (pending?.kind !== "release") return;
          const { payout, idempotencyKey } = pending;
          if (!noLiveTransfer) {
            setFailure("Confirm that you have checked in Stripe that no live transfer exists.");
            return;
          }
          run(
            () =>
              adminReleaseBlockedPayoutResultAction(payout.id, {
                reason,
                noLiveTransferConfirmed: noLiveTransfer,
                idempotencyKey,
              }),
            `release the ${payout.net} payout to ${payout.seller}`,
            `Released the ${payout.net} payout to ${payout.seller}. It can now be retried.`,
          );
        }}
      >
        {pending?.kind === "release" ? (
          <>
            {failureNotice("release")}
            <PayoutFacts payout={pending.payout} />
            {pending.payout.failureReason ? (
              <Notice tone="warning" title="Why it is blocked">
                {pending.payout.failureReason}
              </Notice>
            ) : null}
            <div className="flex items-start gap-2 text-staff-fg text-sm">
              <StaffCheckbox
                id="release-blocked-confirmed"
                checked={noLiveTransfer}
                onCheckedChange={(next) => setNoLiveTransfer(next === true)}
                className="mt-0.5"
              />
              <label htmlFor="release-blocked-confirmed">
                I have checked in Stripe that no live transfer exists for this payout, by its payout
                transfer group and by the seller's account.
              </label>
            </div>
          </>
        ) : null}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={pending?.kind === "reverse"}
        onOpenChange={(next) => {
          if (!next && !busy) close();
        }}
        title={
          pending
            ? `Reverse the ${pending.payout.net} payout to ${pending.payout.seller}?`
            : "Reverse"
        }
        description="Marks the payout as reversed in your finance records. The Stripe transfer is not clawed back automatically. A reversal cannot be undone."
        confirmLabel={pending ? `Reverse ${pending.payout.net}` : "Reverse"}
        tone="danger"
        loading={busy}
        reason={{
          label: "Reason for the reversal",
          description: "Kept in the audit log with your name.",
          minLength: REASON_MIN,
        }}
        {...(pending
          ? { typedConfirmation: payoutReversalConfirmationPhrase(pending.payout.id) }
          : {})}
        onConfirm={({ reason }) => {
          if (pending?.kind !== "reverse") return;
          const { payout, idempotencyKey } = pending;
          run(
            () => adminReversePayoutResultAction(payout.id, { reason, idempotencyKey }),
            `reverse ${payout.net} to ${payout.seller}`,
            `Reversed the ${payout.net} payout to ${payout.seller}`,
          );
        }}
      >
        {pending?.kind === "reverse" ? (
          <>
            {failureNotice("reversal")}
            <PayoutFacts payout={pending.payout} />
          </>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return {
    actionsFor,
    markPaid: (payout: PayoutsStaffRow) => open("mark-paid", payout),
    adjust: (payout: PayoutsStaffRow) => open("adjust", payout),
    retryTransfer: (payout: PayoutsStaffRow) => open("retry", payout),
    adoptBlocked: (payout: PayoutsStaffRow) => open("adopt", payout),
    releaseBlocked: (payout: PayoutsStaffRow) => open("release", payout),
    reverse: (payout: PayoutsStaffRow) => open("reverse", payout),
    dialogs,
  };
}
