import { createHash, randomBytes } from "node:crypto";
import type { RegisteredOidcClientId, SignInMethodKind } from "@auction/identity-contracts";

/**
 * What a one-time ticket is bound to. It is created when LAX Account asks the issuer to add a
 * way to sign in (the `intent` call) and spent when the browser arrives at `/account-action`.
 * Everything that makes the ticket valid is in here, so it can be checked without trusting the
 * browser: the person, the issuer session they are in, what they asked for, and who asked.
 */
export type AccountActionTicket = {
  subjectId: string;
  /** The issuer session (`sid`) the request was made from. The browser must be in that session. */
  sessionId: string;
  action: SignInMethodKind;
  /** The OIDC client that asked. Only LAX Account asks, and only it gets the person back. */
  clientId: RegisteredOidcClientId;
  /** Epoch milliseconds, for the log; expiry itself is the store's. */
  issuedAt: number;
};

export interface AccountActionTicketStore {
  /** Keeps the ticket for `ttlSeconds` and returns the secret the browser carries. */
  issue(ticket: AccountActionTicket, ttlSeconds: number): Promise<string>;
  /**
   * Returns the ticket and removes it in one step, so a ticket can never be used twice, not even by
   * two requests at the same moment. Null when it never existed, has expired or was already used.
   */
  consume(secret: string): Promise<AccountActionTicket | null>;
}

/** 256 bits, base64url. Long enough that it cannot be guessed within its two minutes. */
export function newTicketSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The store holds only a hash of the secret, so a copy of the store (a Redis dump, a log) cannot
 * be turned into working tickets.
 */
export function ticketKey(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url");
}

const SECRET_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** A secret that could not have been issued is refused before the store is asked. */
export function isTicketSecret(value: unknown): value is string {
  return typeof value === "string" && SECRET_SHAPE.test(value);
}
