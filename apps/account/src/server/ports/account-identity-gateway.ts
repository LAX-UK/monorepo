import type { AccountSession } from "@auction/identity-contracts";

/**
 * What the issuer said to a request made on the signed-in person's behalf:
 *  - `reauth_required`: their sign-in is too old for a sensitive change, or has ended, so they
 *    must sign in again;
 *  - `unavailable`: the issuer refused, failed or did not answer; nothing is known to have changed.
 */
export type IdentityCallResult<T> =
  | { status: "ok"; value: T }
  | { status: "reauth_required" }
  | { status: "unavailable" };

/** The signed-in person's tokens: the access token names the person, `sid` names the sign-in. */
export type IdentityActor = { accessToken: string; sid: string };

/** The issuer-owned identity data LAX Account shows and edits. */
export type AccountIdentityGateway = {
  /** The person's current name, or null when the issuer could not answer. */
  readName(actor: IdentityActor): Promise<string | null>;
  rename(actor: IdentityActor, name: string): Promise<IdentityCallResult<string>>;
  listSessions(actor: IdentityActor): Promise<IdentityCallResult<AccountSession[]>>;
  /** Signs out one other device. Resolves to how many sessions were ended. */
  revokeSession(actor: IdentityActor, sessionId: string): Promise<IdentityCallResult<number>>;
  /** Signs out every device except the actor's own. Resolves to how many were ended. */
  revokeOtherSessions(actor: IdentityActor): Promise<IdentityCallResult<number>>;
};
