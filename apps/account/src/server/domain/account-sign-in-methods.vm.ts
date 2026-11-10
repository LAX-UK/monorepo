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
  socialSignInProviderSchema,
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
  /** The address the provider gave, or that it hid; null when it gave none. */
  address: string | null;
  /** When the provider was linked, in the one date style: kept whole on a line of its own. */
  linkedOn: string;
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

/** Why the last way in cannot be removed. One rule, said the same wherever it appears. */
export const ONLY_METHOD_REASON =
  "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.";
/** The same rule when the page offers another way in right beside it. */
const ONLY_METHOD_REASON_WITH_LINK =
  "This is the only way you can sign in. Add another way to sign in first, then you can remove it.";

/** The address a linked provider's row shows: the one it gave, or that Apple kept it back. */
function linkedAddress(method: AccountSignInMethodsResponse["social"][number]): string | null {
  return method.hidden
    ? `Address hidden by ${PROVIDER_LABEL[method.provider]}`
    : method.providerEmail;
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
  const offersLink = SOCIAL_SIGN_IN_PROVIDERS.some(
    (provider) => available[provider] && !social.some((method) => method.provider === provider),
  );
  const onlyMethod = offersLink ? ONLY_METHOD_REASON_WITH_LINK : ONLY_METHOD_REASON;
  const providerRows = SOCIAL_SIGN_IN_PROVIDERS.flatMap((provider): SignInMethodRowVm[] => {
    const linked = social.find((method) => method.provider === provider);
    const label = PROVIDER_LABEL[provider];
    if (linked) {
      return [
        {
          kind: "social",
          provider,
          title: label,
          address: linkedAddress(linked),
          linkedOn: `Linked ${formatDate(linked.linkedAt)}`,
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
  // The hint is for a person whose one way in is not a password, and only when no row already
  // says it: a row that carries the reason needs no second line under the list.
  const rowSaysIt = rows.some((row) => row.kind === "social" && row.blockedReason !== null);
  return {
    status: "list",
    rows,
    hint:
      !hasPassword && isLastMethod && !rowSaysIt
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

/** The provider a notice names, or null when the issuer did not say (then the notice is general). */
type FlashProvider = SocialSignInProvider | null;

/** The notice for each return word. Each says which provider it is about when it is known. */
const FLASH: Record<AccountSignInMethodReturn, (provider: FlashProvider) => FlashCopy> = {
  google_linked: () => ({
    tone: "success",
    title: "Google is linked",
    body: "You can now sign in with it.",
  }),
  apple_linked: () => ({
    tone: "success",
    title: "Apple is linked",
    body: "You can now sign in with it.",
  }),
  passkey_added: () => ({
    tone: "success",
    title: "Passkey added",
    body: "You can sign in with it next time.",
  }),
  cancelled: (provider) => ({
    tone: "neutral",
    title: provider ? `Linking ${PROVIDER_LABEL[provider]} was cancelled` : "Linking was cancelled",
    body: "Nothing changed. You can try again whenever you like.",
  }),
  already_linked_elsewhere: (provider) => {
    const label = provider ? PROVIDER_LABEL[provider] : null;
    return {
      tone: "error",
      title: label
        ? `That ${label} account is already linked to another LAX Account`
        : "That account is already linked to another LAX Account",
      body: label
        ? `Each ${label} account can sign in to one LAX Account. Sign in to the other account and remove ${label} there, or link a different ${label} account.`
        : "Each Google or Apple account can sign in to one LAX Account. Sign in to the other account and remove it there, or link a different one.",
    };
  },
  provider_unavailable: (provider) => ({
    tone: "error",
    title: provider
      ? `We couldn't finish linking ${PROVIDER_LABEL[provider]}`
      : "We couldn't finish linking",
    body: "Nothing changed. Try again in a moment.",
  }),
  expired: (provider) => ({
    tone: "warning",
    title: "That took too long",
    body: provider
      ? `Nothing changed. Choose Link ${PROVIDER_LABEL[provider]} again to start over.`
      : "Nothing changed. Choose the Link button again to start over.",
  }),
  reauth_required: (provider) => ({
    tone: "warning",
    title: provider
      ? `Sign in again to link ${PROVIDER_LABEL[provider]}`
      : "Sign in again to add a way in",
    body: "For your security we need a recent sign-in before adding a way in.",
    reauth: true,
  }),
  rate_limited: () => ({
    tone: "error",
    title: "Too many attempts",
    body: "Wait a few minutes and try again.",
  }),
  passkey_limit: () => ({
    tone: "error",
    title: `You have ${PASSKEY_LIMIT} passkeys, the most an account can have`,
    body: "Remove one to add another.",
  }),
  staff_not_allowed: () => ({
    tone: "error",
    title: "Staff accounts can't sign in with Google or Apple",
    body: "Add a passkey instead.",
  }),
};

/** What the account actually holds, which a notice must agree with. Null when it is not known. */
export type SignInMethodFacts = {
  linked: readonly SocialSignInProvider[];
  passkeys: number;
};

const firstOf = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

/** Whether the account bears out what the notice claims; an address typed by hand does not. */
function agreesWithAccount(
  word: AccountSignInMethodReturn,
  provider: FlashProvider,
  facts: SignInMethodFacts | null,
): boolean {
  switch (word) {
    case "google_linked":
    case "apple_linked":
      return facts?.linked.includes(word === "google_linked" ? "google" : "apple") === true;
    case "passkey_added":
      return (facts?.passkeys ?? 0) > 0;
    case "already_linked_elsewhere":
      // Said of a provider that is not linked here; where it is linked here the claim is false.
      return facts !== null && !(provider && facts.linked.includes(provider));
    default:
      return true;
  }
}

/**
 * The notice for the `?signInMethod=` word the issuer sent the person back with. Only the issuer's
 * fixed words and providers are understood, and a success is shown only when the account really
 * has what it says; anything else (a mistyped, edited or made-up address) shows nothing, and no
 * part of the parameters is ever shown.
 */
export function buildSignInMethodFlash(
  rawWord: string | string[] | undefined,
  rawProvider: string | string[] | undefined,
  facts: SignInMethodFacts | null,
): SignInMethodFlashVm | null {
  const word = firstOf(rawWord);
  if (!word || !(ACCOUNT_SIGN_IN_METHOD_RETURNS as readonly string[]).includes(word)) return null;
  const known = word as AccountSignInMethodReturn;
  const parsed = socialSignInProviderSchema.safeParse(firstOf(rawProvider));
  const provider: FlashProvider = parsed.success ? parsed.data : null;
  if (!agreesWithAccount(known, provider, facts)) return null;
  const { reauth, ...copy } = FLASH[known](provider);
  return { ...copy, reauth: reauth === true };
}

/** What the account holds, read from the list the page is about to show. */
export function signInMethodFacts(
  result: IdentityCallResult<AccountSignInMethodsResponse> | null,
): SignInMethodFacts | null {
  if (!result || result.status !== "ok") return null;
  return {
    linked: result.value.social.map((method) => method.provider),
    passkeys: result.value.passkeys.length,
  };
}
