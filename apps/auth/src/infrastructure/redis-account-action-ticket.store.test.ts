import { describe, expect, it } from "vitest";
import type { AccountActionTicket } from "../services/account-action-ticket.js";
import { isTicketSecret, newTicketSecret, ticketKey } from "../services/account-action-ticket.js";
import {
  RedisAccountActionTicketStore,
  type TicketRedis,
} from "./redis-account-action-ticket.store.js";

const TICKET: AccountActionTicket = {
  subjectId: "11111111-1111-4111-8111-111111111111",
  sessionId: "sid-1",
  action: "google",
  clientId: "lax-account-web",
  issuedAt: 1_800_000_000_000,
};

function fakeRedis() {
  const data = new Map<string, { value: string; ttl: number }>();
  const redis: TicketRedis = {
    async set(key, value, _mode, ttl) {
      data.set(key, { value, ttl });
      return "OK";
    },
    async getdel(key) {
      const entry = data.get(key);
      data.delete(key);
      return entry?.value ?? null;
    },
  };
  return { redis, data };
}

describe("ticket secrets", () => {
  it("are 256 random bits that look like what they are, and differ every time", () => {
    const a = newTicketSecret();
    const b = newTicketSecret();
    expect(a).not.toBe(b);
    expect(isTicketSecret(a)).toBe(true);
    expect(a).toHaveLength(43);
  });

  it("are recognised by shape before the store is asked", () => {
    for (const bad of [undefined, null, "", "short", "x".repeat(44), `${"a".repeat(42)}!`, 42]) {
      expect(isTicketSecret(bad)).toBe(false);
    }
  });

  it("are stored only as a hash", () => {
    const secret = newTicketSecret();
    expect(ticketKey(secret)).not.toContain(secret);
    expect(ticketKey(secret)).toBe(ticketKey(secret));
    expect(ticketKey(secret)).not.toBe(ticketKey(newTicketSecret()));
  });
});

describe("RedisAccountActionTicketStore", () => {
  it("keeps a ticket for the time asked and never keeps the secret itself", async () => {
    const { redis, data } = fakeRedis();
    const secret = await new RedisAccountActionTicketStore(redis).issue(TICKET, 120);
    const stored = [...data.entries()][0];
    if (!stored) throw new Error("nothing was stored");
    const [key, entry] = stored;
    expect(entry.ttl).toBe(120);
    expect(key).toBe(`auth:account-action:${ticketKey(secret)}`);
    expect(key).not.toContain(secret);
    expect(JSON.parse(entry.value)).toEqual(TICKET);
  });

  it("returns the ticket once and never again", async () => {
    const store = new RedisAccountActionTicketStore(fakeRedis().redis);
    const secret = await store.issue(TICKET, 120);
    expect(await store.consume(secret)).toEqual(TICKET);
    expect(await store.consume(secret)).toBeNull();
  });

  it("lets only one of two requests at the same moment have it", async () => {
    const store = new RedisAccountActionTicketStore(fakeRedis().redis);
    const secret = await store.issue(TICKET, 120);
    const results = await Promise.all([store.consume(secret), store.consume(secret)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("knows nothing of a secret it did not issue, or one of the wrong shape", async () => {
    const store = new RedisAccountActionTicketStore(fakeRedis().redis);
    expect(await store.consume(newTicketSecret())).toBeNull();
    expect(await store.consume("not-a-ticket")).toBeNull();
  });

  it("reads a damaged or foreign record as no ticket", async () => {
    const { redis, data } = fakeRedis();
    const store = new RedisAccountActionTicketStore(redis);
    const secret = newTicketSecret();
    for (const stored of [
      "not json",
      "null",
      JSON.stringify({ ...TICKET, action: "carrier-pigeon" }),
      JSON.stringify({ ...TICKET, subjectId: "" }),
      JSON.stringify({ subjectId: TICKET.subjectId }),
    ]) {
      data.set(`auth:account-action:${ticketKey(secret)}`, { value: stored, ttl: 1 });
      expect(await store.consume(secret)).toBeNull();
    }
  });
});
