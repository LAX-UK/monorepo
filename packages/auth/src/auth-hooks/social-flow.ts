import type { AccountLinkReader } from "../ports/account-link-reader.js";
import type { TwoFactorPolicyStore } from "../ports/two-factor-policy-store.js";
import type { ImplicitLinkBlockReason, SocialSubject } from "../social-sign-in-policy.js";

/**
 * What one provider round trip decided along the way, kept on the request so the hook that
 * finishes the callback can act on it. The database hooks and the callback's after hook see the
 * same endpoint context, which is why this lives there and nowhere longer-lived.
 */
export type SocialFlow = {
  /** A new account is being created in this request (a first Google or Apple sign-up). */
  newUser: boolean;
  /** An automatic link was refused, and why; the callback sends the person back to sign in. */
  blockedLink: ImplicitLinkBlockReason | null;
  /** The provider proved an unconfirmed email: drop the old password once the session exists. */
  secureUserId: string | null;
};

const FLOW_KEY = "laxSocialFlow";

type ContextWithFlow = { context?: Record<string, unknown> | undefined };

/** The flow of this request; a detached object when there is no request (nothing keeps it). */
export function socialFlow(endpointContext: unknown): SocialFlow {
  const holder = (endpointContext as ContextWithFlow | null | undefined)?.context;
  if (!holder) return { newUser: false, blockedLink: null, secureUserId: null };
  const existing = holder[FLOW_KEY] as SocialFlow | undefined;
  if (existing) return existing;
  const created: SocialFlow = { newUser: false, blockedLink: null, secureUserId: null };
  holder[FLOW_KEY] = created;
  return created;
}

export type SocialSubjectPorts = {
  accountLinkReader: Pick<AccountLinkReader, "isEmailVerified">;
  twoFactorPolicyStore: Pick<
    TwoFactorPolicyStore,
    "readSubjectPolicyInputs" | "readTwoFactorEnabled"
  >;
};

/**
 * Reads what the social rules need about an existing account. It fails closed: when a fact
 * cannot be read the error stops the sign-in or link instead of letting it through.
 */
export async function readSocialSubject(
  ports: SocialSubjectPorts,
  userId: string,
): Promise<SocialSubject> {
  const [emailVerified, inputs, twoFactor] = await Promise.all([
    ports.accountLinkReader.isEmailVerified(userId),
    ports.twoFactorPolicyStore.readSubjectPolicyInputs(userId),
    ports.twoFactorPolicyStore.readTwoFactorEnabled([userId]),
  ]);
  if (emailVerified === null) throw new Error("social sign-in subject not found");
  return {
    isStaff: inputs.markers.some((marker) => marker.kind === "staff"),
    twoFactorEnabled: twoFactor.get(userId) === true,
    emailVerified,
  };
}
