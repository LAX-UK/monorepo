"use client";

import { requestAccountDeletionAction } from "@/server/application/account-identity-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type DeleteAccountFormProps = {
  /** What the person must type, exactly. */
  phrase: string;
  /** What deleting does, one sentence each, shown above the button. */
  consequences: string[];
  /** Where to come back to after a fresh sign-in, which deleting requires. */
  returnTo: string;
};

/**
 * The confirm step of account deletion. The button stays disabled until the phrase is typed
 * exactly, and the issuer re-checks every product and the sign-in's age when it is pressed, so
 * the page being out of date, or the sign-in being old, can never delete anything by itself.
 */
export function DeleteAccountForm({ phrase, consequences, returnTo }: DeleteAccountFormProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await requestAccountDeletionAction(typed);
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result.status === "error") {
        setError(result.message);
        // A refusal means something changed since the page loaded: show what is in the way now.
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (typed === phrase) submit();
      }}
    >
      <ul className="list-disc space-y-2 pl-5 text-sm text-on-surface">
        {consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>
          Type <span className="font-semibold">{phrase}</span> to confirm
        </Label>
        <Input
          className="h-11"
          id={inputId}
          name="confirmation"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
        />
      </div>
      <div id={messageId} aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
      <LoadingButton
        type="submit"
        variant="destructive"
        loading={pending}
        loadingLabel="Deleting…"
        disabled={typed !== phrase}
        className="min-h-11"
      >
        Delete my account
      </LoadingButton>
    </form>
  );
}
