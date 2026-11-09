import { SIGN_IN_METHOD_KINDS } from "@auction/identity-contracts";
import {
  type AccountActionTicket,
  type AccountActionTicketStore,
  isTicketSecret,
  newTicketSecret,
  ticketKey,
} from "../services/account-action-ticket.js";

const KEY_PREFIX = "auth:account-action:";

export type TicketRedis = {
  set(key: string, value: string, mode: "EX", ttlSec: number): Promise<unknown>;
  /** Atomic read-and-delete (Redis 6.2 and later). */
  getdel(key: string): Promise<string | null>;
};

function isTicket(value: unknown): value is AccountActionTicket {
  if (!value || typeof value !== "object") return false;
  const ticket = value as Record<string, unknown>;
  return (
    typeof ticket.subjectId === "string" &&
    ticket.subjectId.length > 0 &&
    typeof ticket.sessionId === "string" &&
    ticket.sessionId.length > 0 &&
    typeof ticket.action === "string" &&
    (SIGN_IN_METHOD_KINDS as readonly string[]).includes(ticket.action) &&
    typeof ticket.clientId === "string" &&
    typeof ticket.issuedAt === "number"
  );
}

/** Single-use tickets in Redis, keyed by a hash of the secret and gone after their time to live. */
export class RedisAccountActionTicketStore implements AccountActionTicketStore {
  constructor(private readonly redis: TicketRedis) {}

  async issue(ticket: AccountActionTicket, ttlSeconds: number): Promise<string> {
    const secret = newTicketSecret();
    await this.redis.set(
      `${KEY_PREFIX}${ticketKey(secret)}`,
      JSON.stringify(ticket),
      "EX",
      ttlSeconds,
    );
    return secret;
  }

  async consume(secret: string): Promise<AccountActionTicket | null> {
    if (!isTicketSecret(secret)) return null;
    const stored = await this.redis.getdel(`${KEY_PREFIX}${ticketKey(secret)}`);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      return isTicket(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
