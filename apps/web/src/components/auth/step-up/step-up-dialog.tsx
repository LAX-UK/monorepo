"use client";

import type { IStepUpCoordinator } from "@/lib/auth/step-up/use-step-up-coordinator";
import { PasswordReauthDialog } from "./password-reauth-dialog";
import { SetupPasswordPromptDialog } from "./setup-password-prompt-dialog";

export function StepUpDialog({ coordinator }: { coordinator: IStepUpCoordinator }) {
  const { state, submitPassword, cancel } = coordinator;
  return (
    <>
      <PasswordReauthDialog
        open={state.mode === "password"}
        busy={state.busy}
        error={state.error}
        onSubmit={(pw) => void submitPassword(pw)}
        onCancel={cancel}
      />
      <SetupPasswordPromptDialog open={state.mode === "no_credential"} onCancel={cancel} />
    </>
  );
}
