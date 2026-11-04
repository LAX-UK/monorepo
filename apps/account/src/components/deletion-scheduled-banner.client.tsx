"use client";

import { cancelAccountDeletionAction } from "@/server/application/account-identity-actions.server";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { useState, useTransition } from "react";
import { LoadingButton } from "./account-button";
import { NOTICE, NoticeTitle } from "./account-ui";

type Outcome =
  | { kind: "scheduled" }
  | { kind: "kept"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "signed_out" };

/**
 * Shown on every page while the person has asked to delete their account, so a request made a
 * month ago is never a surprise. It names the day and cancels the deletion in place; once kept,
 * it confirms that once and is gone on the next page.
 */
export function DeletionScheduledBanner({
  dueOn,
  signInHref,
}: {
  /** The day the account is erased, already written for a reader, such as "2 December". */
  dueOn: string;
  /** Where to sign in again when the sign-in has ended before the person could keep the account. */
  signInHref: string;
}) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "scheduled" });
  const [pending, startTransition] = useTransition();

  if (outcome.kind === "kept") {
    return (
      <Alert variant="success" aria-live="polite" className={NOTICE}>
        <NoticeTitle>{outcome.message}</NoticeTitle>
      </Alert>
    );
  }

  function keepAccount() {
    startTransition(async () => {
      const result = await cancelAccountDeletionAction();
      if (result.status === "ok") {
        setOutcome({ kind: "kept", message: result.message });
        return;
      }
      setOutcome(
        result.status === "error"
          ? { kind: "failed", message: result.message }
          : { kind: "signed_out" },
      );
    });
  }

  return (
    <Alert variant="warning" role="note" className={NOTICE}>
      <NoticeTitle>{`Your account will be deleted on ${dueOn}.`}</NoticeTitle>
      <AlertDescription>
        Changed your mind? Keep your account and nothing is removed.
      </AlertDescription>
      <LoadingButton
        type="button"
        variant="outline"
        loading={pending}
        loadingLabel="Keeping your account…"
        className="mt-2 self-start"
        onClick={keepAccount}
      >
        Keep my account
      </LoadingButton>
      <div aria-live="polite">
        {outcome.kind === "failed" ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {outcome.message}
          </p>
        ) : null}
        {outcome.kind === "signed_out" ? (
          <p role="alert" className="mt-2 text-sm text-error">
            Your sign-in has ended.{" "}
            <a href={signInHref} className="font-semibold underline underline-offset-4">
              Sign in
            </a>{" "}
            again, then keep your account.
          </p>
        ) : null}
      </div>
    </Alert>
  );
}
