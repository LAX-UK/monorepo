import { createHash } from "node:crypto";

/** How long a person has, once their ticket is spent, to make the passkey. */
export const PASSKEY_ENROLMENT_GRANT_TTL_SECONDS = 300;

/**
 * Permission to make one passkey, given when the one-time hand-off for adding a passkey is spent
 * (a ticket, a recent sign-in, the browser in the very session the request was made from). It
 * belongs to that session and lasts five minutes. The passkey endpoints ask for it, so a signed-in
 * browser cannot make a passkey without going through the hand-off, whatever Better Auth's own
 * "fresh session" rule would allow.
 */
export interface PasskeyEnrolmentGrants {
  /** Gives the session permission to make a passkey, replacing any it already had. */
  grant(sessionId: string, subjectId: string): Promise<void>;
  /** Whether the session has permission now, without using it up (the options call and the verify call both ask). */
  holds(sessionId: string, subjectId: string): Promise<boolean>;
  /** Uses the permission up once a passkey has been made; false when there was none. */
  spend(sessionId: string, subjectId: string): Promise<boolean>;
  /** Remembers the passkey just made in this enrolment, the only one the naming step may rename. */
  noteCreated(sessionId: string, subjectId: string, passkeyId: string): Promise<void>;
  /** The passkey made in this enrolment, or null when none was (or it belongs to another person). */
  createdPasskey(sessionId: string, subjectId: string): Promise<string | null>;
}

/** Where the id of the passkey just made is kept: beside the grant, with the same lifetime. */
export function passkeyCreatedKey(sessionId: string): string {
  return `${passkeyGrantKey(sessionId)}:created`;
}

/** The key never holds the session id itself, so a Redis dump names no session. */
export function passkeyGrantKey(sessionId: string): string {
  return `auth:passkey-enrolment:${createHash("sha256").update(sessionId).digest("base64url")}`;
}
