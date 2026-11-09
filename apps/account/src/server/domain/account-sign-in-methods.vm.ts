import { formatDate } from "@/lib/format-date";
import {
  ACCOUNT_SIGN_IN_METHOD_ERRORS,
  type AccountSignInMethodError,
  type AccountSignInMethodsResponse,
  type SocialSignInProvider,
} from "@auction/identity-contracts/account";
import type { IdentityCallResult } from "../ports/account-identity-gateway";

export const PROVIDER_LABEL: Record<SocialSignInProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export type PasswordRowVm = {
  kind: "password";
  title: "Password";
  isSet: boolean;
  /** "Set" or "Not set", shown as text so the state never depends on colour. */
  status: string;
  detail: string;
  actionLabel: string;
};

export type SocialRowVm = {
  kind: "social";
  provider: SocialSignInProvider;
  title: string;
  /** The account's address and when the provider was linked. */
  detail: string;
  /** Null when it can be removed; otherwise the sentence that says why not. */
  blockedReason: string | null;
};

export type SignInMethodRowVm = PasswordRowVm | SocialRowVm;

/**
 * What the "Sign-in methods" section shows. The two ways the list can be missing need different
 * answers, so the page never has to guess from a missing list:
 *  - `reauth_required`: the issuer no longer knows this sign-in, so the person signs in again;
 *  - `unavailable`: the issuer could not answer; the methods are unknown, not absent.
 */
export type SignInMethodsSectionVm =
  | { status: "list"; rows: SignInMethodRowVm[]; hint: string | null }
  | { status: "reauth_required" }
  | { status: "unavailable" };

export const ONLY_METHOD_REASON =
  "This is the only way you can sign in. Add a password first, then you can remove it.";

export function buildSignInMethodsSection(
  result: IdentityCallResult<AccountSignInMethodsResponse> | null,
  email: string | null,
): SignInMethodsSectionVm {
  // Listing has no refusal the person can act on, so a refusal reads as "could not answer".
  if (!result || result.status === "unavailable" || result.status === "rejected") {
    return { status: "unavailable" };
  }
  if (result.status === "reauth_required") return { status: "reauth_required" };
  const { hasPassword, social } = result.value;
  const isLastMethod = !hasPassword && social.length === 1;
  const rows: SignInMethodRowVm[] = [
    {
      kind: "password",
      title: "Password",
      isSet: hasPassword,
      status: hasPassword ? "Set" : "Not set",
      detail: hasPassword
        ? "Sign in with your email and password."
        : "Add one to sign in with your email as well.",
      actionLabel: hasPassword ? "Change" : "Add a password",
    },
    ...social.map(
      (method): SocialRowVm => ({
        kind: "social",
        provider: method.provider,
        title: PROVIDER_LABEL[method.provider],
        detail: [email, `Linked ${formatDate(method.linkedAt)}`].filter(Boolean).join(" · "),
        blockedReason: isLastMethod ? ONLY_METHOD_REASON : null,
      }),
    ),
  ];
  return {
    status: "list",
    rows,
    hint: isLastMethod
      ? "You sign in with one method only. Add a password so you can still get in if you lose access to it."
      : null,
  };
}

export type RemoveConfirmVm = { title: string; body: string; confirmLabel: string };

/** What the confirm dialog says before a social sign-in is removed. */
export function buildRemoveConfirm(
  provider: SocialSignInProvider,
  remaining: readonly string[],
): RemoveConfirmVm {
  const label = PROVIDER_LABEL[provider];
  const left =
    remaining.length > 0
      ? `You'll still be able to sign in with ${remaining.join(" or ")}.`
      : "You'll sign in with your email and password.";
  return {
    title: `Remove ${label} sign-in?`,
    body: `You'll no longer be able to sign in to LAX with ${label}. ${left} Every other device will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art, and we'll email you to confirm. If you signed in a while ago, we'll ask you to sign in again first.`,
    confirmLabel: `Remove ${label}`,
  };
}

const REJECTIONS: Record<AccountSignInMethodError, string> = {
  last_sign_in_method: ONLY_METHOD_REASON,
  not_linked: "That sign-in isn't linked to your account any more.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  passkey_limit: "You've reached the most passkeys you can have. Remove one to add another.",
  not_available: "That way to sign in isn't available right now.",
  staff_not_allowed: "Staff accounts can't sign in with Google or Apple. Add a passkey instead.",
};

export function signInMethodRejectionMessage(reason: AccountSignInMethodError): string {
  return REJECTIONS[reason];
}

/** Narrows the issuer's refusal reasons to the ones that are about sign-in methods. */
export function isSignInMethodRejection(reason: string): reason is AccountSignInMethodError {
  return (ACCOUNT_SIGN_IN_METHOD_ERRORS as readonly string[]).includes(reason);
}
