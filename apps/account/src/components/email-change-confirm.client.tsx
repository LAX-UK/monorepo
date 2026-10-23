"use client";

import { confirmEmailChangeAction } from "@/server/application/account-identity-actions.server";
import { buildEmailChangeConfirmationVm } from "@/server/domain/email-change-confirmation.vm";
import { Button } from "@auction/ui/components/button";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useState, useTransition } from "react";

type State =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "done"; heading: string; body: string; signInAgain: boolean };

type EmailChangeConfirmProps = {
  /** The signed token from the emailed link; empty when the link was cut short. */
  token: string;
  /** Where a person whose email has changed signs in again. */
  signInHref: string;
};

/**
 * Confirms one inbox of an email change. The link only opens this page; the change is made by
 * the button, because mail scanners and link previews open links on their own and must not be
 * able to confirm a change for the person.
 */
export function EmailChangeConfirm({ token, signInHref }: EmailChangeConfirmProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function confirmChange() {
    startTransition(async () => {
      const result = await confirmEmailChangeAction(token);
      if (result.status === "error") {
        setState({ kind: "error", message: result.message });
        return;
      }
      setState({ kind: "done", ...buildEmailChangeConfirmationVm(result) });
    });
  }

  if (state.kind === "done") {
    return (
      <div className="space-y-4" aria-live="polite">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">{state.heading}</h1>
        <p className="text-sm text-on-surface-variant">{state.body}</p>
        {state.signInAgain ? (
          <Button asChild variant="cta" size="lg">
            <a href={signInHref}>Sign in</a>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-headline text-2xl font-semibold tracking-tight">
        Confirm your email change
      </h1>
      <p className="text-sm text-on-surface-variant">
        Your email address changes once you've confirmed it from both your current and your new
        address. Confirm this one now.
      </p>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-error">
          {state.message}
        </p>
      ) : null}
      <LoadingButton
        type="button"
        variant="cta"
        size="lg"
        loading={pending}
        loadingLabel="Confirming…"
        disabled={!token}
        onClick={confirmChange}
      >
        Confirm email change
      </LoadingButton>
    </div>
  );
}
