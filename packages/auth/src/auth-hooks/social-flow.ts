import type { AccountLinkReader } from "../ports/account-link-reader.js";
import type { IdentityLifecycleEvent } from "../ports/identity-event-publisher.js";
import type { TwoFactorPolicyStore } from "../ports/two-factor-policy-store.js";
import {
  type ImplicitLinkBlockReason,
  type SocialProviderId,
  type SocialSubject,
  isSocialProviderId,
} from "../social-sign-in-policy.js";

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

/** What the policy needs from the hook's dependencies, plus the place a failed read is reported. */
export type SocialPolicyDeps = {
  ports: SocialSubjectPorts & {
    events?: { publish(event: IdentityLifecycleEvent): Promise<void> } | undefined;
  };
  onSocialPolicyReadFailed?: ((error: unknown) => void) | undefined;
};

/**
 * Reads the subject for a Google or Apple decision. A read that fails is reported and then
 * rethrown, so the sign-in fails closed and the failure is visible to whoever watches the metric.
 */
export async function readSocialSubjectReporting(
  deps: SocialPolicyDeps,
  userId: string,
): Promise<SocialSubject> {
  try {
    return await readSocialSubject(deps.ports, userId);
  } catch (error) {
    try {
      deps.onSocialPolicyReadFailed?.(error);
    } catch {
      // Reporting must never replace the refusal.
    }
    throw error;
  }
}

/** The provider a request is for: the callback's path parameter or an ID-token sign-in's body. */
export function socialProviderOfRequest(endpointContext: unknown): SocialProviderId | null {
  const ctx = endpointContext as
    | { params?: { id?: unknown }; body?: { provider?: unknown } }
    | null
    | undefined;
  const candidate = ctx?.params?.id ?? ctx?.body?.provider;
  return typeof candidate === "string" && isSocialProviderId(candidate) ? candidate : null;
}

/** Records, for the audit trail, that a staff account was refused a Google or Apple link or sign-in. */
export async function recordStaffRefusal(
  deps: SocialPolicyDeps,
  input: { userId: string; provider: SocialProviderId | null; attempt: "link" | "sign_in" },
): Promise<void> {
  if (!input.provider) return;
  try {
    await deps.ports.events?.publish({
      type: "user.social_link_refused_staff",
      userId: input.userId,
      provider: input.provider,
      attempt: input.attempt,
    });
  } catch {
    // The refusal stands whether or not the record could be written.
  }
}
