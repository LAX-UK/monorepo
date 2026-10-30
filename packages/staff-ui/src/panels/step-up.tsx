"use client";

import {
  STAFF_STEP_UP_MAX_AGE_SECONDS,
  STAFF_STEP_UP_REQUIRED,
} from "@auction/identity-contracts/staff-step-up";
import { Notice } from "@auction/ui/lax";
import { ShieldCheck } from "lucide-react";
import * as React from "react";
import { StaffButton } from "../primitives/button.js";
import { StaffDialog } from "./staff-dialog.js";

/*
 * Step-up: money, roles, sign-in protection and impersonation need a sign-in from the last few
 * minutes. When an action comes back with `step_up_required`, the person's work stays where it
 * is; they are asked to confirm it is them, sign in again, return to the page and repeat the
 * action. Both staff tools answer the same way, from the same contract.
 */

const WINDOW_MINUTES = Math.round(STAFF_STEP_UP_MAX_AGE_SECONDS / 60);

/** Why the person is being asked, in one sentence. */
export const STAFF_STEP_UP_REASON = `Actions like this need a sign-in from the last ${WINDOW_MINUTES} minutes.`;

type StepUpFailure = { errorCode?: string | undefined; error?: string | undefined; code?: string };

/** True for a failed action result (or a bare code) that asks for a fresh sign-in. */
export function isStaffStepUpRequired(failure: StepUpFailure | string | null | undefined): boolean {
  if (failure == null) return false;
  if (typeof failure === "string") return failure === STAFF_STEP_UP_REQUIRED;
  return [failure.errorCode, failure.error, failure.code].includes(STAFF_STEP_UP_REQUIRED);
}

/**
 * "Confirm it's you": says what is being confirmed and sends the person to sign in again, after
 * which they come back to the page to finish. Cancel leaves everything as it was.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  action,
  onReauthenticate,
  reauthenticating = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What needs confirming, as a verb phrase: "issue £4,210.00 in payouts". */
  action?: string;
  /** Starts the fresh sign-in, e.g. a redirect to the hosted re-authentication page. */
  onReauthenticate: () => void;
  reauthenticating?: boolean;
}) {
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm it’s you"
      description={
        action
          ? `To ${action}, sign in again. You will come back to this page to finish.`
          : "Sign in again to continue. You will come back to this page to finish."
      }
      footer={
        <>
          <StaffButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={reauthenticating}
          >
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            icon={<ShieldCheck aria-hidden />}
            loading={reauthenticating}
            onClick={onReauthenticate}
          >
            Sign in again
          </StaffButton>
        </>
      }
    >
      <p className="text-staff-sm text-staff-muted">{STAFF_STEP_UP_REASON}</p>
    </StaffDialog>
  );
}

/** The same request as a line above the form, for flows that keep their own error area. */
export function StepUpNotice({
  action,
  onReauthenticate,
  className,
}: {
  action?: string;
  onReauthenticate: () => void;
  className?: string;
}) {
  return (
    <Notice
      tone="warning"
      alert
      title={action ? `Confirm it’s you to ${action}` : "Confirm it’s you to continue"}
      actions={
        <StaffButton size="sm" variant="secondary" onClick={onReauthenticate}>
          Sign in again
        </StaffButton>
      }
      {...(className ? { className } : {})}
    >
      {STAFF_STEP_UP_REASON}
    </Notice>
  );
}

/**
 * Wires a step-up request into any action: pass the failure to `handle` and it opens the dialog
 * when the server asked for a fresh sign-in (returning true), or leaves other failures to you.
 *
 * ```tsx
 * const stepUp = useStaffStepUp({ onReauthenticate: redirectToReauth });
 * const result = await refund();
 * if (!result.ok && !stepUp.handle(result, "refund £20.00")) showError(result);
 * return <>{button}{stepUp.dialog}</>;
 * ```
 */
export function useStaffStepUp({ onReauthenticate }: { onReauthenticate: () => void }) {
  const [request, setRequest] = React.useState<{ action?: string } | null>(null);
  const [leaving, setLeaving] = React.useState(false);
  const handle = React.useCallback(
    (failure: StepUpFailure | string | null | undefined, action?: string) => {
      if (!isStaffStepUpRequired(failure)) return false;
      setRequest(action ? { action } : {});
      return true;
    },
    [],
  );
  const dialog = (
    <StepUpDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
      {...(request?.action ? { action: request.action } : {})}
      reauthenticating={leaving}
      onReauthenticate={() => {
        setLeaving(true);
        onReauthenticate();
      }}
    />
  );
  return { handle, dialog, pending: request !== null };
}
