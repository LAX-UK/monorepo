import { PASSWORD_COPY, type PasswordFormMode } from "@/server/domain/account-password.vm";
import { AccountSection } from "./account-ui";
import { ChangePasswordForm } from "./change-password-form.client";

type PasswordSectionProps = {
  mode: PasswordFormMode;
  forgotPasswordHref: string;
  /** The page this section sits on: where to return after signing in again. */
  pagePath: string;
};

/** The password, changed in the page: a form with the current password, the new one and a confirmation. */
export function PasswordSection({ mode, forgotPasswordHref, pagePath }: PasswordSectionProps) {
  const copy = PASSWORD_COPY[mode];
  return (
    <AccountSection id="password" title={copy.title} description={copy.description}>
      <ChangePasswordForm mode={mode} forgotPasswordHref={forgotPasswordHref} returnTo={pagePath} />
    </AccountSection>
  );
}
