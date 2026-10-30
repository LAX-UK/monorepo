"use client";

import { sofReopenAction } from "@/lib/actions/compliance";
import type { SofStaffRow } from "@/lib/admin/compliance/sof-staff-list.vm";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  type OverflowAction,
  useStaffStepUp,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

/**
 * Reopening a rejected source of funds case, from a row's `…` menu. It opens a confirm dialog that
 * names the buyer and the exposure, because reopening clears the maker-checker fields and puts the
 * case back in the pending queue. Only an MLRO can reopen. When the API asks for a fresh sign-in,
 * the step-up dialog takes over.
 */
export function useSofReopenAction({ canReopen }: { canReopen: boolean }) {
  const router = useRouter();
  const [pending, setPendingState] = useState<SofStaffRow | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const setPending = useCallback((next: SofStaffRow | null) => {
    setFailure(null);
    setPendingState(next);
  }, []);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const actionsFor = useCallback(
    (row: SofStaffRow): OverflowAction[] =>
      canReopen && row.canReopen
        ? [{ id: "reopen", label: "Reopen for review", onSelect: () => setPending(row) }]
        : [],
    [canReopen, setPending],
  );

  const confirm = () => {
    if (!pending) return;
    const row = pending;
    setFailure(null);
    startTransition(async () => {
      const result = await sofReopenAction({ caseId: row.id });
      if (result.ok) {
        setPending(null);
        notify.success(`Reopened the case for ${row.buyer}`);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, `Reopen the case for ${row.buyer}`)) {
        setPending(null);
        return;
      }
      setFailure(result.error);
    });
  };

  const dialogs = (
    <>
      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={pending ? `Reopen the rejected case for ${pending.buyer}?` : "Reopen case"}
        description="The maker-checker fields are cleared and the case returns to pending review. Settlement stays blocked until it is approved again."
        confirmLabel="Reopen for review"
        loading={busy}
        onConfirm={confirm}
      >
        {pending ? (
          <div className="flex flex-col gap-3">
            {failure ? (
              <Notice tone="danger" alert title="The case was not reopened">
                {failure}
              </Notice>
            ) : null}
            <div className="rounded-staff-lg border border-staff-line px-3 py-1">
              <KeyValueList
                items={[
                  { label: "Buyer", value: pending.buyer },
                  { label: "Exposure", value: pending.exposure, numeric: true },
                  { label: "Trigger", value: pending.trigger },
                ]}
              />
            </div>
          </div>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return { actionsFor, dialogs };
}
