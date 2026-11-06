"use client";

import { LoadingButton } from "@/components/account-button";
import { Button } from "@/components/account-button";
import { FIELD } from "@/components/account-ui";
import { changePasswordAction } from "@/server/application/account-identity-actions.server";
import {
  FORGOT_PASSWORD_LABEL,
  PASSWORD_COPY,
  PASSWORD_FIELDS,
  type PasswordField,
  type PasswordFormErrors,
  type PasswordFormMode,
  type PasswordFormValues,
  buildPasswordHints,
  validatePasswordForm,
} from "@/server/domain/account-password.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { MarketingCheckIcon, MarketingMinusIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { ErrorSummary, TextLink } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type ChangePasswordFormProps = {
  mode: PasswordFormMode;
  /** The hosted page that emails a reset link, for people who do not know their current password. */
  forgotPasswordHref: string;
  /** Where to come back to after a fresh sign-in, which changing the password may require. */
  returnTo: string;
  /** Overrides the card look, for a form that opens inside another card. */
  className?: string;
};

const EMPTY: PasswordFormValues = { current: "", next: "", confirm: "" };

const LABELS: Record<PasswordField, string> = {
  current: "Current password",
  next: "New password",
  confirm: "Confirm new password",
};

/**
 * Changes the password in the page (or adds a first one). Hints tick off as the person types;
 * mistakes are listed in the error summary and under their fields. Saving needs a recent
 * sign-in: when the issuer says it is too old the person is sent through a fresh one and returns
 * here. The passwords live only in this component's state and are cleared after a success.
 */
export function ChangePasswordForm({
  mode,
  forgotPasswordHref,
  returnTo,
  className,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const baseId = useId();
  const ids: Record<PasswordField, string> = {
    current: `${baseId}-current`,
    next: `${baseId}-next`,
    confirm: `${baseId}-confirm`,
  };
  const hintsId = `${baseId}-hints`;
  const [values, setValues] = useState<PasswordFormValues>(EMPTY);
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();
  const copy = PASSWORD_COPY[mode];
  const fields = PASSWORD_FIELDS.filter((field) => mode === "change" || field !== "current");
  const hints = buildPasswordHints(values, mode);
  const summary = fields.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: ids[field], message }] : [];
  });

  function edit(field: PasswordField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError(null);
    setSuccess(null);
  }

  function submit() {
    setSuccess(null);
    setFormError(null);
    setSubmitCount((count) => count + 1);
    const found = validatePasswordForm(values, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: mode === "change" ? values.current : null,
        newPassword: values.next,
      }).catch(() => null);
      if (result?.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        return;
      }
      if (result?.status === "ok") {
        setValues(EMPTY);
        setVisible(false);
        setSuccess(PASSWORD_COPY[result.created ? "create" : "change"].success);
        router.refresh();
        return;
      }
      if (result?.status === "error" && result.field) {
        setErrors({ [result.field]: result.message });
        return;
      }
      setFormError(
        result?.status === "error"
          ? result.message
          : "We couldn't do that just now. Nothing was changed. Please try again in a moment.",
      );
    });
  }

  return (
    <form
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-6",
        className,
      )}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ErrorSummary errors={summary} focusKey={submitCount} />
      {formError ? (
        <p role="alert" className="text-sm text-error">
          {formError}
        </p>
      ) : null}
      {success ? <output className="text-sm font-medium text-success">{success}</output> : null}

      {fields.map((field) => {
        const message = errors[field];
        const describedBy = [
          message ? `${ids[field]}-error` : null,
          field === "next" ? hintsId : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={ids[field]}>{LABELS[field]}</Label>
            <Input
              className={FIELD}
              id={ids[field]}
              name={field}
              type={visible ? "text" : "password"}
              autoComplete={field === "current" ? "current-password" : "new-password"}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={values[field]}
              onChange={(event) => edit(field, event.target.value)}
              aria-invalid={message ? true : undefined}
              aria-describedby={describedBy || undefined}
            />
            {message ? (
              <p id={`${ids[field]}-error`} className="text-sm text-error">
                {message}
              </p>
            ) : null}
            {field === "next" ? (
              <ul id={hintsId} className="flex flex-col gap-1 pt-1">
                {hints.map((hint) => (
                  <li
                    key={hint.id}
                    className={`flex items-center gap-2 text-xs ${hint.met ? "text-success" : "text-on-surface-variant"}`}
                  >
                    {hint.met ? (
                      <MarketingCheckIcon className="size-4 shrink-0" strokeWidth={1.75} />
                    ) : (
                      <MarketingMinusIcon className="size-4 shrink-0" strokeWidth={1.75} />
                    )}
                    <span>
                      {hint.label}
                      <span className="sr-only">{hint.met ? " (done)" : " (not yet)"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}

      <Button
        type="button"
        variant="link"
        size="inline"
        aria-pressed={visible}
        className="min-h-11 self-start text-on-surface underline underline-offset-4"
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? "Hide passwords" : "Show passwords"}
      </Button>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LoadingButton
          type="submit"
          variant="cta"
          loading={pending}
          loadingLabel="Saving…"
          className="min-h-11"
        >
          {copy.submit}
        </LoadingButton>
        {mode === "change" ? (
          <TextLink href={forgotPasswordHref} className="min-h-11 items-center">
            {FORGOT_PASSWORD_LABEL}
          </TextLink>
        ) : null}
      </div>
    </form>
  );
}
