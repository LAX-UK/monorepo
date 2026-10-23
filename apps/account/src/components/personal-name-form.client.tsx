"use client";

import { renameAccountAction } from "@/server/application/account-identity-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type FormState =
  | { kind: "idle" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

type PersonalNameFormProps = {
  /** The person's name now; null when they have not set one. */
  initialName: string | null;
  maxLength: number;
  /** Where to come back to after a fresh sign-in, which renaming may require. */
  returnTo: string;
};

/**
 * Editable name (Personal details). Saving needs a recent sign-in; when the issuer says it is
 * too old the person is sent through a fresh one and returns to this page to save again.
 */
export function PersonalNameForm({ initialName, maxLength, returnTo }: PersonalNameFormProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const [value, setValue] = useState(initialName ?? "");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const trimmed = value.trim();
  const unchanged = trimmed === (initialName ?? "");

  function save() {
    if (!trimmed) {
      setState({ kind: "error", message: "Enter your name." });
      return;
    }
    startTransition(async () => {
      const result = await renameAccountAction(trimmed);
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result.status === "ok") {
        setValue(trimmed);
        setState({ kind: "saved", message: result.message });
        router.refresh();
        return;
      }
      setState({ kind: "error", message: result.message });
    });
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          name="name"
          autoComplete="name"
          maxLength={maxLength}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (state.kind !== "idle") setState({ kind: "idle" });
          }}
          aria-invalid={state.kind === "error" || undefined}
          aria-describedby={state.kind === "idle" ? undefined : messageId}
        />
        <p className="text-xs text-on-surface-variant">
          Your name is shared with LAX Bid, LAX Shop and lax.art.
        </p>
      </div>
      <div id={messageId} aria-live="polite">
        {state.kind === "error" ? (
          <p role="alert" className="text-sm text-error">
            {state.message}
          </p>
        ) : null}
        {state.kind === "saved" ? <p className="text-sm text-success">{state.message}</p> : null}
      </div>
      <LoadingButton
        type="submit"
        variant="cta"
        loading={pending}
        loadingLabel="Saving…"
        disabled={unchanged}
        className="min-h-11"
      >
        Save name
      </LoadingButton>
    </form>
  );
}
