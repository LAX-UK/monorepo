import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  type AccountPasswordError,
} from "@auction/identity-contracts/account";
import type { AccountSecurityFacts } from "./account-security-facts";

/** "change" asks for the current password; "create" sets the first one on a social or passkey account. */
export type PasswordFormMode = "change" | "create";

/** An unknown answer is treated as "has a password": asking for the current one is the safe mistake. */
export function passwordFormMode(
  facts: Pick<AccountSecurityFacts, "hasPassword">,
): PasswordFormMode {
  return facts.hasPassword === false ? "create" : "change";
}

export type PasswordField = "current" | "next" | "confirm";

/** The fields in the order they appear on the page. */
export const PASSWORD_FIELDS = [
  "current",
  "next",
  "confirm",
] as const satisfies readonly PasswordField[];

export type PasswordFormValues = { current: string; next: string; confirm: string };

export type PasswordFormErrors = Partial<Record<PasswordField, string>>;

export const PASSWORD_COPY = {
  change: {
    title: "Password",
    description:
      "Changing it signs you out on every other device. We'll email you to confirm the change.",
    submit: "Update password",
    success: "Your password has been updated. Every other device has been signed out.",
  },
  create: {
    title: "Password",
    description:
      "You sign in without a password today. Add one to sign in with your email as well. We'll email you to confirm.",
    submit: "Add password",
    success: "Your password has been added. Every other device has been signed out.",
  },
} as const satisfies Record<PasswordFormMode, unknown>;

export const FORGOT_PASSWORD_LABEL = "Forgot your password?";

/**
 * What the new password is checked against. The issuer enforces these (and a common-password and
 * breach check besides); the hints only let the person see progress while typing.
 */
export type PasswordHint = { id: "length" | "different" | "match"; label: string; met: boolean };

export function buildPasswordHints(
  values: PasswordFormValues,
  mode: PasswordFormMode,
): PasswordHint[] {
  const hints: PasswordHint[] = [
    {
      id: "length",
      label: `At least ${ACCOUNT_PASSWORD_MIN_LENGTH} characters`,
      met: values.next.length >= ACCOUNT_PASSWORD_MIN_LENGTH,
    },
  ];
  if (mode === "change") {
    hints.push({
      id: "different",
      label: "Different from your current password",
      met: values.next.length > 0 && values.next !== values.current,
    });
  }
  hints.push({
    id: "match",
    label: "Both new passwords match",
    met: values.next.length > 0 && values.next === values.confirm,
  });
  return hints;
}

/** Checks the form before it is sent. The first message per field is the one shown. */
export function validatePasswordForm(
  values: PasswordFormValues,
  mode: PasswordFormMode,
): PasswordFormErrors {
  const errors: PasswordFormErrors = {};
  if (mode === "change" && !values.current) errors.current = "Enter your current password.";
  if (!values.next) errors.next = "Enter a new password.";
  else if (values.next.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
    errors.next = `Use at least ${ACCOUNT_PASSWORD_MIN_LENGTH} characters.`;
  } else if (values.next.length > ACCOUNT_PASSWORD_MAX_LENGTH) {
    errors.next = `Use no more than ${ACCOUNT_PASSWORD_MAX_LENGTH} characters.`;
  } else if (mode === "change" && values.next === values.current) {
    errors.next = "Choose a password that's different from your current one.";
  }
  if (!values.confirm) errors.confirm = "Enter your new password again.";
  else if (values.next !== values.confirm) errors.confirm = "The two new passwords don't match.";
  return errors;
}

const REJECTIONS: Record<AccountPasswordError, { field: PasswordField; message: string }> = {
  invalid_password: { field: "current", message: "That isn't your current password." },
  invalid_password_policy: {
    field: "next",
    message: "That password is too easy to guess. Use a longer or less common one.",
  },
  password_breached: {
    field: "next",
    message: "That password has appeared in a data breach. Choose a different one.",
  },
  same_password: {
    field: "next",
    message: "Choose a password that's different from your current one.",
  },
  rate_limited: {
    field: "current",
    message: "Too many attempts. Wait a few minutes and try again.",
  },
};

/** The field a refusal belongs to and the sentence shown under it and in the error summary. */
export function passwordRejection(reason: AccountPasswordError): {
  field: PasswordField;
  message: string;
} {
  return REJECTIONS[reason];
}

/** Narrows the issuer's refusal reasons to the ones that are about the password. */
export function isPasswordRejection(reason: string): reason is AccountPasswordError {
  return Object.hasOwn(REJECTIONS, reason);
}
