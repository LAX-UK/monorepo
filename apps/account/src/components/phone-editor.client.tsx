"use client";

import {
  sendPhoneCodeAction,
  verifyPhoneAction,
} from "@/server/application/account-identity-actions.server";
import type { AccountActionResult } from "@/server/domain/account-action-result";
import { normalisePhoneInput, phoneEntryLabel } from "@/server/domain/account-contact.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { ACCOUNT_PHONE_CODE_LENGTH } from "@auction/identity-contracts/account";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type PhoneEditorProps = {
  /** The number on file, in international form; null when there is none. */
  phone: string | null;
  phoneVerified: boolean;
  /** Where to come back to after a fresh sign-in, which sending a code may require. */
  returnTo: string;
};

type Step = { kind: "idle" } | { kind: "enter" } | { kind: "code"; target: string };
type Notice = { kind: "error" | "success"; message: string };

/**
 * Add, change or verify the phone number. A code is texted to the number and the number is
 * saved only when the code is entered, so a typo can never put someone else's number on the
 * account. Each step needs a recent sign-in; when the issuer says it is too old the person is
 * sent through a fresh one and returns here.
 */
export function PhoneEditor({ phone, phoneVerified, returnTo }: PhoneEditorProps) {
  const phoneId = useId();
  const codeId = useId();
  const messageId = `${phoneId}-message`;
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AccountActionResult>, onOk: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result.status === "error") {
        setNotice({ kind: "error", message: result.message });
        return;
      }
      setNotice({ kind: "success", message: result.message });
      onOk();
    });
  }

  function sendCode(target: string, next: Step) {
    run(
      () => sendPhoneCodeAction(target),
      () => {
        setCode("");
        setStep(next);
      },
    );
  }

  function submitNumber() {
    const target = normalisePhoneInput(number);
    if (!target) {
      setNotice({
        kind: "error",
        message: "Enter your phone number with its country code, for example +44 7700 900123.",
      });
      return;
    }
    sendCode(target, { kind: "code", target });
  }

  function submitCode(target: string) {
    run(
      () => verifyPhoneAction(target, code),
      () => {
        setStep({ kind: "idle" });
        setNumber("");
        router.refresh();
      },
    );
  }

  function cancel() {
    setStep({ kind: "idle" });
    setNotice(null);
  }

  const message = (
    <div id={messageId} aria-live="polite">
      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={notice.kind === "error" ? "text-sm text-error" : "text-sm text-success"}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );

  if (step.kind === "enter") {
    return (
      <form
        className="space-y-3 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submitNumber();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={phoneId}>Phone number</Label>
          <Input
            id={phoneId}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+44 7700 900123"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              if (notice) setNotice(null);
            }}
            aria-invalid={notice?.kind === "error" || undefined}
            aria-describedby={notice ? messageId : undefined}
          />
          <p className="text-xs text-on-surface-variant">
            Include your country code. We'll text you a 6-digit code.
          </p>
        </div>
        {message}
        <div className="flex flex-wrap gap-3">
          <LoadingButton
            type="submit"
            variant="cta"
            loading={pending}
            loadingLabel="Sending…"
            className="min-h-11"
          >
            Send code
          </LoadingButton>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={cancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step.kind === "code") {
    const { target } = step;
    return (
      <form
        className="space-y-3 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submitCode(target);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={codeId}>Verification code</Label>
          <Input
            id={codeId}
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={ACCOUNT_PHONE_CODE_LENGTH}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, ""));
              if (notice) setNotice(null);
            }}
            aria-invalid={notice?.kind === "error" || undefined}
            aria-describedby={messageId}
          />
          <p className="text-xs text-on-surface-variant">
            Enter the code we texted to <span className="font-medium break-all">{target}</span>.
          </p>
        </div>
        {message}
        <div className="flex flex-wrap gap-3">
          <LoadingButton
            type="submit"
            variant="cta"
            loading={pending}
            loadingLabel="Checking…"
            disabled={code.length !== ACCOUNT_PHONE_CODE_LENGTH}
            className="min-h-11"
          >
            Verify number
          </LoadingButton>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => sendCode(target, step)}
          >
            Send a new code
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              setNotice(null);
              setStep({ kind: "enter" });
            }}
          >
            Use a different number
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3 px-4">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          setNotice(null);
          if (phone && !phoneVerified) sendCode(phone, { kind: "code", target: phone });
          else setStep({ kind: "enter" });
        }}
      >
        {phoneEntryLabel(phone, phoneVerified)}
      </Button>
      {message}
    </div>
  );
}
