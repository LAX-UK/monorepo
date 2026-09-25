"use client";

import { StepUpDialogShell } from "@/components/auth/step-up/step-up-dialog-shell";
import {
  type IStepUpCoordinator,
  buildHostedReauthHref,
} from "@/lib/auth/step-up/use-step-up-coordinator";
import { Button } from "@auction/ui/components/button";
import { SetupPasswordPromptDialog } from "./setup-password-prompt-dialog";

export function StepUpDialog({ coordinator }: { coordinator: IStepUpCoordinator }) {
  const { state, cancel } = coordinator;

  if (state.mode === "password") {
    return (
      <StepUpDialogShell
        open
        onOpenChange={(o) => !o && cancel()}
        title="Confirm with your password"
        description={state.error ?? "Sign in again with your password to continue."}
        descriptionId="step-up-password-desc"
        footer={
          <>
            <Button type="button" size="sm" asChild>
              <a href={buildHostedReauthHref()}>Sign in again</a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </>
        }
        footerClassName="flex-col gap-2 sm:flex-col"
      />
    );
  }

  return <SetupPasswordPromptDialog open={state.mode === "no_credential"} onCancel={cancel} />;
}
