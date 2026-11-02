"use client";

import { allocateDisputeResultAction } from "@/lib/actions/admin/admin-dispute-allocation";
import {
  type DisputeShares,
  allocationEffects,
  allocationLines,
  checkAllocation,
  splitInProportion,
} from "@/lib/admin/finance/dispute-allocation";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, Notice, formatStaffMoney, useStaffStepUp } from "@auction/staff-ui";
import type { DisputeDeskCase } from "@auction/types";
import { ADMIN_DISPUTE_ALLOCATION_NOTE_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { DisputeEffectList } from "./dispute-effect-list";

/**
 * The finance team's allocation of a dispute: the shares being edited, their check against the
 * disputed amount, and the confirm dialog that names what changes for each seller and asks why.
 * Saving with shares that do not add up shows the problem on the rows instead of disabling the
 * button, so the person is told what to fix. A stale sign-in hands over to the step-up dialog.
 */
export function useDisputeAllocation(found: DisputeDeskCase) {
  const router = useRouter();
  const [shares, setShares] = useState<DisputeShares>(() =>
    splitInProportion(found.invoices, found.amountPence),
  );
  const [showProblems, setShowProblems] = useState(false);
  const [confirming, setConfirming] = useState<{ key: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const check = useMemo(
    () => checkAllocation(found.invoices, shares, found.amountPence),
    [found.invoices, found.amountPence, shares],
  );
  const effects = useMemo(
    () => allocationEffects(found.invoices, shares),
    [found.invoices, shares],
  );
  const fundsTaken = found.fundsWithdrawnAt !== null && found.fundsReinstatedAt === null;

  const setShare = useCallback((paymentId: string, pence: number | null) => {
    setShares((current) => ({ ...current, [paymentId]: pence ?? 0 }));
  }, []);

  const splitProportionally = useCallback(() => {
    setShares(splitInProportion(found.invoices, found.amountPence));
  }, [found.invoices, found.amountPence]);

  /** Opens the confirm dialog, or reveals what is wrong with the shares. Returns whether it opened. */
  const requestSave = useCallback(() => {
    if (!check.valid) {
      setShowProblems(true);
      return false;
    }
    setFailure(null);
    setConfirming({ key: crypto.randomUUID() });
    return true;
  }, [check.valid]);

  const submit = (note: string) => {
    if (!confirming) return;
    const { key } = confirming;
    setFailure(null);
    startTransition(async () => {
      const result = await allocateDisputeResultAction({
        caseId: found.id,
        expectedVersion: found.version,
        lines: allocationLines(found.invoices, shares),
        note,
        idempotencyKey: key,
      });
      if (result.ok) {
        setConfirming(null);
        notify.success("Allocation saved");
        router.refresh();
        return;
      }
      if (stepUp.handle(result, "Save allocation")) {
        setConfirming(null);
        return;
      }
      setFailure(result.error);
    });
  };

  const amount = formatStaffMoney(found.amountPence, found.currency);
  const dialog = (
    <>
      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirming(null);
        }}
        title="Save this allocation?"
        description={
          fundsTaken
            ? `Stripe has already withdrawn ${amount}, so the seller shares are taken from their payouts now. If the dispute is won, they are returned.`
            : `${amount} is put on the invoices below. The seller shares are taken from their payouts if Stripe withdraws the funds, and returned if the dispute is won.`
        }
        confirmLabel="Save allocation"
        loading={busy}
        reason={{
          label: "Reason for this allocation",
          description: "Kept in the audit log with your name.",
          minLength: ADMIN_DISPUTE_ALLOCATION_NOTE_MIN,
          placeholder: "For example, the buyer paid for all three lots in one checkout.",
        }}
        onConfirm={({ reason }) => submit(reason)}
      >
        {failure ? (
          <Notice tone="danger" alert title="The allocation did not go through">
            {failure}
          </Notice>
        ) : null}
        <DisputeEffectList effects={effects} currency={found.currency} fundsTaken={fundsTaken} />
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return {
    shares,
    setShare,
    splitProportionally,
    check,
    effects,
    fundsTaken,
    showProblems,
    requestSave,
    saving: busy,
    dialog,
  };
}
