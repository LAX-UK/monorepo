import { PASSWORD_COPY, type PasswordFormMode } from "@/server/domain/account-password.vm";
import { ChangePasswordForm } from "./change-password-form.client";

type PasswordPanelProps = {
  mode: PasswordFormMode;
  forgotPasswordHref: string;
  /** The page this panel sits on: where to return after signing in again. */
  pagePath: string;
};

/**
 * The password form with the line that says what saving does. It has no heading of its own: it
 * opens under the Password row of "How you sign in".
 */
export function PasswordPanel({ mode, forgotPasswordHref, pagePath }: PasswordPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-on-surface-variant">{PASSWORD_COPY[mode].description}</p>
      <ChangePasswordForm
        mode={mode}
        forgotPasswordHref={forgotPasswordHref}
        returnTo={pagePath}
        className="border-0 p-0 sm:p-0"
      />
    </div>
  );
}
