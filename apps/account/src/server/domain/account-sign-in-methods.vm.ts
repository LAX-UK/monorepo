import { formatDate } from "@/lib/format-date";
import {
  ACCOUNT_SIGN_IN_METHOD_ERRORS,
  ACCOUNT_SIGN_IN_METHOD_RETURNS,
  type AccountSignInMethodError,
  type AccountSignInMethodReturn,
  type AccountSignInMethodsResponse,
  PASSKEY_LIMIT,
  SOCIAL_SIGN_IN_PROVIDERS,
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
  /** The address the provider gave (or that it hid) and when the provider was linked. */
  detail: string;
  /** Null when it can be removed; otherwise the sentence that says why not. */
  blockedReason: string | null;
};

/** A provider the person has not linked and this environment offers: a row with a Link button. */
export type LinkRowVm = {
  kind: "link";
  provider: SocialSignInProvider;
  title: string;
  /** "Not linked.", all that fits beside the button on a phone. */
  detail: string;
  /** What the row adds from the small-tablet width up: "Sign in with your Google Account." */
  detailMore: string;
  actionLabel: string;
  /** The button's label while the browser is being handed to the issuer. */
  busyLabel: string;
};

export type SignInMethodRowVm = PasswordRowVm | SocialRowVm | LinkRowVm;

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
const ONLY_METHOD_REASON_WITH_PASSKEY =
  "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.";

/** What a linked provider's row says: the address it gave, or that Apple kept it back. */
function linkedDetail(method: AccountSignInMethodsResponse["social"][number]): string {
  const label = PROVIDER_LABEL[method.provider];
  const address = method.hidden ? `Address hidden by ${label}` : method.providerEmail;
  return [address, `Linked ${formatDate(method.linkedAt)}`].filter(Boolean).join(" · ");
}

export function buildSignInMethodsSection(
  result: IdentityCallResult<AccountSignInMethodsResponse> | null,
): SignInMethodsSectionVm {
  // Listing has no refusal the person can act on, so a refusal reads as "could not answer".
  if (!result || result.status === "unavailable" || result.status === "rejected") {
    return { status: "unavailable" };
  }
  if (result.status === "reauth_required") return { status: "reauth_required" };
  const { hasPassword, social, passkeys, available } = result.value;
  // Every kind counts: the emailed sign-in link does not, as it is not a way to sign in on its own.
  const isLastMethod = (hasPassword ? 1 : 0) + social.length + passkeys.length === 1;
  const onlyMethod = available.passkey ? ONLY_METHOD_REASON_WITH_PASSKEY : ONLY_METHOD_REASON;
  const providerRows = SOCIAL_SIGN_IN_PROVIDERS.flatMap((provider): SignInMethodRowVm[] => {
    const linked = social.find((method) => method.provider === provider);
    const label = PROVIDER_LABEL[provider];
    if (linked) {
      return [
        {
          kind: "social",
          provider,
          title: label,
          detail: linkedDetail(linked),
          blockedReason: isLastMethod ? onlyMethod : null,
        },
      ];
    }
    // A provider this environment does not offer has no row; staff are offered none.
    if (!available[provider]) return [];
    return [
      {
        kind: "link",
        provider,
        title: label,
        detail: "Not linked.",
        detailMore: `Sign in with your ${label} Account.`,
        actionLabel: `Link ${label}`,
        busyLabel: `Opening ${label}…`,
      },
    ];
  });
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
    ...providerRows,
  ];
  return {
    status: "list",
    rows,
    // Only for a person whose one way in is not a password: a password-only account is as it was.
    hint:
      !hasPassword && isLastMethod
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
  already_linked: "That way to sign in is already linked to your account.",
};

export function signInMethodRejectionMessage(reason: AccountSignInMethodError): string {
  return REJECTIONS[reason];
}

/** Narrows the issuer's refusal reasons to the ones that are about sign-in methods. */
export function isSignInMethodRejection(reason: string): reason is AccountSignInMethodError {
  return (ACCOUNT_SIGN_IN_METHOD_ERRORS as readonly string[]).includes(reason);
}

export type SignInMethodFlashTone = "success" | "neutral" | "warning" | "error";

/** What the Security page says when the issuer sends the person back, in its own words. */
export type SignInMethodFlashVm = {
  tone: SignInMethodFlashTone;
  title: string;
  body: string;
  /** Offers "Sign in again", for the one outcome that is fixed by a fresh sign-in. */
  reauth: boolean;
};

type FlashCopy = Omit<SignInMethodFlashVm, "reauth"> & { reauth?: true };

const FLASH: Record<AccountSignInMethodReturn, FlashCopy> = {
  google_linked: {
    tone: "success",
    title: "Google is linked",
    body: "You can now sign in with it.",
  },
  apple_linked: {
    tone: "success",
    title: "Apple is linked",
    body: "You can now sign in with it.",
  },
  passkey_added: {
    tone: "success",
    title: "Passkey added",
    body: "You can sign in with it next time.",
  },
  cancelled: {
    tone: "neutral",
    title: "Linking was cancelled",
    body: "Nothing changed. You can try again whenever you like.",
  },
  already_linked_elsewhere: {
    tone: "error",
    title: "That account is already linked to another LAX Account",
    body: "Each Google or Apple account can sign in to one LAX Account. Sign in to the other account and remove it there, or link a different one.",
  },
  provider_unavailable: {
    tone: "error",
    title: "We couldn't finish linking",
    body: "Nothing changed. Try again in a moment.",
  },
  expired: {
    tone: "warning",
    title: "That took too long",
    body: "Nothing changed. Choose the button again to start over.",
  },
  reauth_required: {
    tone: "warning",
    title: "Sign in again to add a way in",
    body: "For your security we need a recent sign-in before adding a way in.",
    reauth: true,
  },
  rate_limited: {
    tone: "error",
    title: "Too many attempts",
    body: "Wait a few minutes and try again.",
  },
  passkey_limit: {
    tone: "error",
    title: `You have ${PASSKEY_LIMIT} passkeys, the most an account can have`,
    body: "Remove one to add another.",
  },
  staff_not_allowed: {
    tone: "error",
    title: "Staff accounts can't sign in with Google or Apple",
    body: "Add a passkey instead.",
  },
};

/**
 * The notice for the `?signInMethod=` word the issuer sent the person back with. Only the issuer's
 * fixed words are understood; anything else (a mistyped or edited address) shows nothing, and no
 * part of the parameter is ever shown.
 */
export function buildSignInMethodFlash(
  raw: string | string[] | undefined,
): SignInMethodFlashVm | null {
  const word = Array.isArray(raw) ? raw[0] : raw;
  if (!word || !(ACCOUNT_SIGN_IN_METHOD_RETURNS as readonly string[]).includes(word)) return null;
  const { reauth, ...copy } = FLASH[word as AccountSignInMethodReturn];
  return { ...copy, reauth: reauth === true };
}
