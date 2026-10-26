"use client";

import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, type ConfirmReason, Notice, useStaffStepUp } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState, useTransition } from "react";

/** What a staff server action answers: success, or a failure with the API's message and code. */
export type StaffActionResult =
  | { ok: true }
  | { ok: false; error: string; errorCode?: string | undefined };

/** One consequential action, asked about before it runs. */
export type StaffConfirmRequest = {
  /** A question naming the action and the record: "Withdraw Blue Interior?" */
  title: string;
  /** What will happen, including what cannot be undone. */
  description: ReactNode;
  /** The verb again: "Withdraw lot". */
  confirmLabel: string;
  /** The way out, when "Cancel" would read as the action itself: "Keep sale". */
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** An audited reason, sent with the action. */
  reason?: ConfirmReason;
  /** The record's name or reference, typed to confirm the rare catastrophic action. */
  typedConfirmation?: string;
  /** Facts shown above the fields: the record, the amount. */
  body?: ReactNode;
  /** "withdraw this lot", for "To withdraw this lot, sign in again". */
  stepUpAction?: string;
  run: (details: { reason: string }) => Promise<StaffActionResult>;
  /** The toast once it is done: "Blue Interior withdrawn". */
  success: string;
  /** A line under the toast, read once the action has run: "Sending the change to ATG now." */
  successDescription?: () => string;
  /** After success; the list refreshes unless this navigates away. */
  onSuccess?: () => void;
  /** A failure this caller handles itself (e.g. Connect not ready); true when handled. */
  onFailure?: (failure: { error: string; errorCode?: string | undefined }) => boolean;
};

/**
 * Asks before a consequential staff action, then runs it: the kit confirm (Cancel focused first,
 * an audited reason or typed confirmation when asked for), step-up when the API wants a fresh
 * sign-in, a toast on success and a refresh of the page's data. A failure stays in the dialog,
 * with what was typed, so the person can fix it or cancel; it never disappears in a toast.
 */
export function useStaffConfirm() {
  const router = useRouter();
  const [request, setRequest] = useState<StaffConfirmRequest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const ask = useCallback((next: StaffConfirmRequest) => {
    setFailure(null);
    setRequest(next);
  }, []);

  const close = () => {
    setFailure(null);
    setRequest(null);
  };

  const confirm = (details: { reason: string }) => {
    const current = request;
    if (!current) return;
    setFailure(null);
    startTransition(async () => {
      const result = await current.run(details);
      if (result.ok) {
        close();
        const description = current.successDescription?.();
        if (description) notify.success(current.success, { description });
        else notify.success(current.success);
        if (current.onSuccess) current.onSuccess();
        else router.refresh();
        return;
      }
      if (stepUp.handle(result, current.stepUpAction)) {
        close();
        return;
      }
      if (current.onFailure?.(result)) {
        close();
        return;
      }
      setFailure(result.error);
    });
  };

  const dialog = (
    <>
      <ConfirmActionDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
        title={request?.title ?? ""}
        description={request?.description ?? ""}
        confirmLabel={request?.confirmLabel ?? "Confirm"}
        {...(request?.cancelLabel ? { cancelLabel: request.cancelLabel } : {})}
        tone={request?.tone ?? "default"}
        loading={busy}
        onConfirm={confirm}
        {...(request?.reason ? { reason: request.reason } : {})}
        {...(request?.typedConfirmation !== undefined
          ? { typedConfirmation: request.typedConfirmation }
          : {})}
      >
        {failure || request?.body ? (
          <>
            {failure ? (
              <Notice tone="danger" alert title="That did not go through">
                {failure}
              </Notice>
            ) : null}
            {request?.body}
          </>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return { ask, dialog, busy };
}
