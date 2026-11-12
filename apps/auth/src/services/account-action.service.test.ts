import { describe, expect, it, vi } from "vitest";
import type { AccountActionTicket, AccountActionTicketStore } from "./account-action-ticket.js";
import { AccountActionService } from "./account-action.service.js";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ISSUER = "https://auth.test";

function session(id: string, ageSeconds: number) {
  return {
    id,
    createdAt: new Date(NOW.getTime() - ageSeconds * 1_000),
    updatedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ipAddress: null,
    userAgent: null,
    lastPasswordAuthAt: null,
    lastActiveAt: new Date(NOW.getTime() - 30_000),
    signedInAt: new Date(NOW.getTime() - 60_000),
    isStaff: false,
    previousIds: [] as readonly string[],
    country: null,
    clientIds: [],
    isCurrent: false,
  };
}

/** An in-memory store with the contract's rules: single use, and gone after its time. */
function memoryTickets(now: () => Date) {
  const held = new Map<string, { ticket: AccountActionTicket; expiresAt: number }>();
  let serial = 0;
  const store: AccountActionTicketStore = {
    async issue(ticket, ttlSeconds) {
      const secret = `${(++serial).toString().padStart(43, "t")}`;
      held.set(secret, { ticket, expiresAt: now().getTime() + ttlSeconds * 1_000 });
      return secret;
    },
    async consume(secret) {
      const entry = held.get(secret);
      held.delete(secret);
      return entry && entry.expiresAt > now().getTime() ? entry.ticket : null;
    },
  };
  return { store, held };
}

function setup(
  options: {
    sessions?: ReturnType<typeof session>[];
    staff?: boolean;
    linked?: ("google" | "apple")[];
    available?: { google: boolean; apple: boolean; passkey: boolean };
    readSubject?: () => Promise<{ isStaff: boolean }>;
  } = {},
) {
  let clock = NOW;
  const now = () => clock;
  const { store, held } = memoryTickets(now);
  const operations = {
    listSessions: vi.fn(async () => options.sessions ?? [session("sid-1", 30)]),
    readSignInMethods: vi.fn(async () => ({
      hasPassword: true,
      social: (options.linked ?? []).map((provider) => ({
        provider,
        linkedAt: NOW,
        providerEmail: null,
        hidden: false,
      })),
      passkeys: [],
    })),
  };
  const readSubject = vi.fn(
    options.readSubject ?? (async () => ({ isStaff: options.staff === true })),
  );
  const grants = { grant: vi.fn(async () => undefined) };
  const service = new AccountActionService(
    {
      tickets: store,
      grants,
      operations: operations as never,
      readSubject,
      available: options.available ?? { google: true, apple: true, passkey: false },
      issuerOrigin: ISSUER,
    },
    now,
  );
  return {
    service,
    grants,
    held,
    operations,
    readSubject,
    advance: (seconds: number) => {
      clock = new Date(clock.getTime() + seconds * 1_000);
    },
  };
}

const secretOf = (url: string) => new URL(url).searchParams.get("ticket") ?? "";

async function started(
  context: ReturnType<typeof setup>,
  action: "google" | "apple" | "passkey" = "google",
) {
  const result = await context.service.start(SUBJECT, "sid-1", action);
  if (!result.ok) throw new Error(`expected a ticket, got ${JSON.stringify(result)}`);
  return secretOf(result.url);
}

describe("AccountActionService.start: the intent", () => {
  it("gives a one-time address on the issuer for a recent sign-in", async () => {
    const context = setup();
    const result = await context.service.start(SUBJECT, "sid-1", "google");
    expect(result).toMatchObject({ ok: true });
    if (!result.ok || !("url" in result)) throw new Error("no url");
    const url = new URL(result.url);
    expect(url.origin).toBe(ISSUER);
    expect(url.pathname).toBe("/account-action");
    expect(url.searchParams.get("ticket")).toHaveLength(43);
  });

  it("binds the ticket to the person, the session, the action and the Account client", async () => {
    const context = setup();
    await context.service.start(SUBJECT, "sid-1", "apple");
    const [entry] = [...context.held.values()];
    expect(entry?.ticket).toEqual({
      subjectId: SUBJECT,
      sessionId: "sid-1",
      action: "apple",
      clientId: "lax-account-web",
      issuedAt: NOW.getTime(),
    });
  });

  it("asks for a fresh sign-in when this one is older than five minutes, and issues nothing", async () => {
    const context = setup({ sessions: [session("sid-1", 301)] });
    expect(await context.service.start(SUBJECT, "sid-1", "google")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(context.held.size).toBe(0);
  });

  it("accepts a sign-in of exactly five minutes", async () => {
    const context = setup({ sessions: [session("sid-1", 300)] });
    expect((await context.service.start(SUBJECT, "sid-1", "google")).ok).toBe(true);
  });

  it("never treats an earlier name of a newer record as a recent sign-in", async () => {
    const context = setup({
      sessions: [{ ...session("sid-2", 30), previousIds: ["sid-1"] }],
    });
    expect(await context.service.start(SUBJECT, "sid-1", "google")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(context.held.size).toBe(0);
  });

  it("still starts for the record LAX Account holds after its own step-up", async () => {
    const context = setup({
      sessions: [{ ...session("sid-2", 30), previousIds: ["sid-1"] }],
    });
    expect((await context.service.start(SUBJECT, "sid-2", "google")).ok).toBe(true);
    expect([...context.held.values()][0]?.ticket.sessionId).toBe("sid-2");
  });

  it("refuses a session that is not the person's own", async () => {
    const context = setup();
    expect(await context.service.start(SUBJECT, "someone-elses-sid", "google")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(context.held.size).toBe(0);
  });

  it("refuses staff for Google and Apple (SM14), and issues nothing", async () => {
    const context = setup({ staff: true });
    expect(await context.service.start(SUBJECT, "sid-1", "google")).toEqual({
      ok: false,
      kind: "staff_not_allowed",
    });
    expect(await context.service.start(SUBJECT, "sid-1", "apple")).toEqual({
      ok: false,
      kind: "staff_not_allowed",
    });
    expect(context.held.size).toBe(0);
  });

  it("refuses a method this environment does not offer, without reading the person", async () => {
    const context = setup({ available: { google: true, apple: false, passkey: false } });
    expect(await context.service.start(SUBJECT, "sid-1", "apple")).toEqual({
      ok: false,
      kind: "not_available",
    });
    expect(await context.service.start(SUBJECT, "sid-1", "passkey")).toEqual({
      ok: false,
      kind: "not_available",
    });
    expect(context.readSubject).not.toHaveBeenCalled();
  });

  it("says a provider is already linked instead of starting a second link", async () => {
    const context = setup({ linked: ["google"] });
    expect(await context.service.start(SUBJECT, "sid-1", "google")).toEqual({
      ok: false,
      kind: "already_linked",
    });
    expect((await context.service.start(SUBJECT, "sid-1", "apple")).ok).toBe(true);
  });

  it("fails closed when the person's staff status cannot be read", async () => {
    const context = setup({
      readSubject: async () => {
        throw new Error("identity database unavailable");
      },
    });
    await expect(context.service.start(SUBJECT, "sid-1", "google")).rejects.toThrow(
      "identity database unavailable",
    );
    expect(context.held.size).toBe(0);
  });
});

describe("AccountActionService.redeem: the browser arrives", () => {
  const browser = { id: "sid-1", userId: SUBJECT };

  it("lets the browser in the same session and person start the provider round trip", async () => {
    const context = setup();
    const secret = await started(context);
    expect(await context.service.redeem(secret, browser)).toEqual({
      ok: true,
      action: "google",
      subjectId: SUBJECT,
    });
  });

  it("gives the session permission to make a passkey when a passkey ticket is spent, and a provider ticket does not", async () => {
    const passkeys = setup({ available: { google: true, apple: true, passkey: true } });
    const secret = await started(passkeys, "passkey");
    expect(await passkeys.service.redeem(secret, browser)).toMatchObject({
      ok: true,
      action: "passkey",
    });
    expect(passkeys.grants.grant).toHaveBeenCalledWith("sid-1", SUBJECT);

    const google = setup();
    await google.service.redeem(await started(google), browser);
    expect(google.grants.grant).not.toHaveBeenCalled();
  });

  it("gives no permission when the browser is in another session, the ticket is spent or the sign-in is stale", async () => {
    const context = setup({ available: { google: true, apple: true, passkey: true } });
    const secret = await started(context, "passkey");
    await context.service.redeem(secret, { id: "sid-2", userId: SUBJECT });
    await context.service.redeem(secret, browser);
    expect(context.grants.grant).not.toHaveBeenCalled();

    const stale = setup({ available: { google: true, apple: true, passkey: true } });
    const staleSecret = await started(stale, "passkey");
    stale.advance(301);
    await stale.service.redeem(staleSecret, browser);
    expect(stale.grants.grant).not.toHaveBeenCalled();
  });

  it("works once: the same address a second time is expired (replay)", async () => {
    const context = setup();
    const secret = await started(context);
    expect((await context.service.redeem(secret, browser)).ok).toBe(true);
    expect(await context.service.redeem(secret, browser)).toEqual({ ok: false, code: "expired" });
  });

  it("is expired after 120 seconds", async () => {
    const context = setup();
    const secret = await started(context);
    context.advance(121);
    expect(await context.service.redeem(secret, browser)).toEqual({ ok: false, code: "expired" });
  });

  it("is still good at 119 seconds", async () => {
    const context = setup({ sessions: [session("sid-1", 0)] });
    const secret = await started(context);
    context.advance(119);
    expect((await context.service.redeem(secret, browser)).ok).toBe(true);
  });

  it("refuses a ticket nobody issued", async () => {
    const context = setup();
    expect(await context.service.redeem("nope".padEnd(43, "x"), browser)).toEqual({
      ok: false,
      code: "expired",
    });
  });

  it("refuses a browser in a different session, and uses the ticket up", async () => {
    const context = setup();
    const secret = await started(context);
    expect(await context.service.redeem(secret, { id: "sid-2", userId: SUBJECT })).toEqual({
      ok: false,
      code: "reauth_required",
      provider: "google",
    });
    // The right browser cannot use it afterwards either.
    expect(await context.service.redeem(secret, browser)).toEqual({ ok: false, code: "expired" });
  });

  it("refuses a browser signed in as a different person", async () => {
    const context = setup();
    const secret = await started(context);
    expect(await context.service.redeem(secret, { id: "sid-1", userId: OTHER })).toEqual({
      ok: false,
      code: "reauth_required",
      provider: "google",
    });
  });

  it("refuses a browser with no session at all", async () => {
    const context = setup();
    const secret = await started(context);
    expect(await context.service.redeem(secret, null)).toEqual({
      ok: false,
      code: "reauth_required",
      provider: "google",
    });
  });

  it("asks for a fresh sign-in when the session grew too old between the request and the visit", async () => {
    const context = setup({ sessions: [session("sid-1", 290)] });
    const secret = await started(context);
    context.advance(20);
    expect(await context.service.redeem(secret, browser)).toEqual({
      ok: false,
      code: "reauth_required",
      provider: "google",
    });
  });

  it("refuses when the person became staff between the request and the visit", async () => {
    let staff = false;
    const context = setup({ readSubject: async () => ({ isStaff: staff }) });
    const secret = await started(context);
    staff = true;
    expect(await context.service.redeem(secret, browser)).toEqual({
      ok: false,
      code: "staff_not_allowed",
      provider: "google",
    });
  });

  it("reports the provider as unreachable when the method was switched off in between", async () => {
    const context = setup({ available: { google: true, apple: true, passkey: false } });
    const secret = await started(context);
    // A second service sees the same ticket with the method now off.
    const off = new AccountActionService(
      {
        grants: { grant: vi.fn(async () => undefined) },
        tickets: {
          issue: async () => "",
          consume: async () => ({
            subjectId: SUBJECT,
            sessionId: "sid-1",
            action: "apple",
            clientId: "lax-account-web",
            issuedAt: NOW.getTime(),
          }),
        },
        operations: context.operations as never,
        readSubject: async () => ({ isStaff: false }),
        available: { google: true, apple: false, passkey: false },
        issuerOrigin: ISSUER,
      },
      () => NOW,
    );
    expect(await off.redeem(secret, browser)).toEqual({
      ok: false,
      code: "provider_unavailable",
      provider: "apple",
    });
  });

  it("treats a provider linked in another tab as done", async () => {
    let linked: ("google" | "apple")[] = [];
    const context = setup();
    context.operations.readSignInMethods.mockImplementation(async () => ({
      hasPassword: true,
      social: linked.map((provider) => ({
        provider,
        linkedAt: NOW,
        providerEmail: null,
        hidden: false,
      })),
      passkeys: [],
    }));
    const secret = await started(context);
    linked = ["google"];
    expect(await context.service.redeem(secret, browser)).toEqual({
      ok: false,
      code: "already_done",
      provider: "google",
    });
  });

  it("refuses a ticket made for another client", async () => {
    const context = setup();
    const secret = await started(context);
    const [entry] = [...context.held.values()];
    if (entry) (entry.ticket as { clientId: string }).clientId = "lax-bid-web";
    expect(await context.service.redeem(secret, browser)).toEqual({ ok: false, code: "expired" });
  });

  it("fails closed when the person's staff status cannot be read", async () => {
    let fail = false;
    const context = setup({
      readSubject: async () => {
        if (fail) throw new Error("identity database unavailable");
        return { isStaff: false };
      },
    });
    const secret = await started(context);
    fail = true;
    await expect(context.service.redeem(secret, browser)).rejects.toThrow("unavailable");
  });
});

describe("AccountActionService.isLinked", () => {
  it("reads the account itself", async () => {
    const context = setup({ linked: ["apple"] });
    expect(await context.service.isLinked(SUBJECT, "apple")).toBe(true);
    expect(await context.service.isLinked(SUBJECT, "google")).toBe(false);
  });
});
