import type { IEmailService } from "@auction/email";
import type {
  IVisitorSaleAlertRepository,
  VisitorSaleAlertRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { createVisitorAlertToken } from "../lib/visitor-alert-token.js";
import { VisitorSaleAlertService } from "./visitor-sale-alert.service.js";

const SECRET = "test-secret-0123456789";

class MemoryRepo implements IVisitorSaleAlertRepository {
  rows = new Map<string, VisitorSaleAlertRecord>();
  consent: Array<{ email: string; consentText: string; consentSource: string }> = [];
  private seq = 0;

  async findByEmail(email: string) {
    return [...this.rows.values()].find((r) => r.email === email) ?? null;
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async savePending(input: {
    email: string;
    consentText: string;
    consentSource: string;
    now: Date;
  }) {
    const existing = await this.findByEmail(input.email);
    if (existing?.status === "confirmed") return existing;
    const row: VisitorSaleAlertRecord = {
      id: existing?.id ?? `s${++this.seq}`,
      email: input.email,
      status: "pending",
      requestedAt: input.now,
      confirmationSentAt: input.now,
      linkedUserId: existing?.linkedUserId ?? null,
    };
    this.rows.set(row.id, row);
    this.consent.push({
      email: input.email,
      consentText: input.consentText,
      consentSource: input.consentSource,
    });
    return row;
  }
  async confirm(id: string) {
    const row = this.rows.get(id);
    if (!row || row.status !== "pending") return false;
    this.rows.set(id, { ...row, status: "confirmed" });
    return true;
  }
  async unsubscribe(id: string) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, status: "unsubscribed" });
  }
  async linkUser(id: string, userId: string) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, linkedUserId: userId });
  }
}

function setup(owner: { email: string; verified: boolean } | null = null) {
  let clock = new Date("2026-11-02T12:00:00Z");
  const subscribers = new MemoryRepo();
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o1" });
  const email = { enqueue } as unknown as IEmailService;
  const service = new VisitorSaleAlertService({
    subscribers,
    email,
    owners: { findEmail: async () => owner },
    secret: SECRET,
    webOrigin: "https://lax.bid/",
    apiPublicUrl: "https://api.lax.bid",
    now: () => clock,
  });
  return {
    service,
    subscribers,
    enqueue,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
  };
}

const tokenFrom = (url: string) => new URL(url).searchParams.get("t") as string;

async function signUp(ctx: ReturnType<typeof setup>, email = "Ada@Example.com") {
  await ctx.service.subscribe({ email, source: "web_home_alerts" });
  const vars = ctx.enqueue.mock.calls.at(-1)?.[0].vars;
  return {
    confirm: tokenFrom(vars.confirmUrl),
    unsubscribe: tokenFrom(vars.unsubscribeUrl),
    vars,
  };
}

describe("VisitorSaleAlertService.subscribe", () => {
  it("stores a pending address with its consent record and mails one confirmation", async () => {
    const ctx = setup();
    const { vars } = await signUp(ctx);

    expect(ctx.subscribers.consent).toEqual([
      expect.objectContaining({
        email: "ada@example.com",
        consentSource: "web_home_alerts",
        consentText: expect.stringContaining("unsubscribe"),
      }),
    ]);
    expect(ctx.enqueue).toHaveBeenCalledTimes(1);
    expect(ctx.enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "visitor-alert-confirm",
      to: "ada@example.com",
      category: "transactional",
    });
    expect(vars.confirmUrl).toMatch(/^https:\/\/lax\.bid\/alerts\/confirm\?t=/);
    expect(vars.unsubscribeUrl).toMatch(/^https:\/\/lax\.bid\/alerts\/unsubscribe\?t=/);
    expect(vars.listUnsubscribeUrl).toMatch(
      /^https:\/\/api\.lax\.bid\/sale-alerts\/unsubscribe\?t=/,
    );
    expect(vars.expirationHours).toBe(48);
  });

  it("does not mail a pending address twice in quick succession, then does after the pause", async () => {
    const ctx = setup();
    await signUp(ctx);
    await ctx.service.subscribe({ email: "ada@example.com", source: "web_home_alerts" });
    expect(ctx.enqueue).toHaveBeenCalledTimes(1);

    ctx.advance(11 * 60 * 1000);
    await ctx.service.subscribe({ email: "ada@example.com", source: "web_home_alerts" });
    expect(ctx.enqueue).toHaveBeenCalledTimes(2);
  });

  it("sends nothing to an address that is already confirmed", async () => {
    const ctx = setup();
    const { confirm } = await signUp(ctx);
    await ctx.service.confirm(confirm);
    ctx.enqueue.mockClear();

    await ctx.service.subscribe({ email: "ada@example.com", source: "web_home_alerts" });
    expect(ctx.enqueue).not.toHaveBeenCalled();
  });

  it("asks an unsubscribed address to confirm again, and the old link then stops working", async () => {
    const ctx = setup();
    const first = await signUp(ctx);
    await ctx.service.confirm(first.confirm);
    await ctx.service.unsubscribe(first.unsubscribe);

    ctx.advance(1000);
    const second = await signUp(ctx);
    expect(await ctx.service.confirm(first.confirm)).toBe("invalid");
    expect(await ctx.service.confirm(second.confirm)).toBe("confirmed");
  });
});

describe("VisitorSaleAlertService.confirm", () => {
  it("confirms once and treats a second click as confirmed too", async () => {
    const ctx = setup();
    const { confirm } = await signUp(ctx);
    expect(await ctx.service.confirm(confirm)).toBe("confirmed");
    expect(await ctx.service.confirm(confirm)).toBe("confirmed");
    expect((await ctx.subscribers.findByEmail("ada@example.com"))?.status).toBe("confirmed");
  });

  it("expires after 48 hours and leaves the address pending", async () => {
    const ctx = setup();
    const { confirm } = await signUp(ctx);
    ctx.advance(48 * 3_600_000 + 1);
    expect(await ctx.service.confirm(confirm)).toBe("expired");
    expect((await ctx.subscribers.findByEmail("ada@example.com"))?.status).toBe("pending");
  });

  it("refuses junk, a forged token and an unsubscribe token", async () => {
    const ctx = setup();
    const { unsubscribe } = await signUp(ctx);
    expect(await ctx.service.confirm("junk")).toBe("invalid");
    expect(await ctx.service.confirm(unsubscribe)).toBe("invalid");
    const forged = createVisitorAlertToken(
      { kind: "confirm", subscriberId: "s1", requestedAtMs: 1 },
      "another-secret-0123456",
    );
    expect(await ctx.service.confirm(forged)).toBe("invalid");
  });
});

describe("VisitorSaleAlertService unsubscribe", () => {
  it("previews the address and unsubscribes it, however often it is clicked", async () => {
    const ctx = setup();
    const { unsubscribe } = await signUp(ctx);
    expect(await ctx.service.unsubscribePreview(unsubscribe)).toEqual({
      email: "ada@example.com",
    });
    expect(await ctx.service.unsubscribe(unsubscribe)).toBe(true);
    expect(await ctx.service.unsubscribe(unsubscribe)).toBe(true);
    expect((await ctx.subscribers.findByEmail("ada@example.com"))?.status).toBe("unsubscribed");
  });

  it("rejects a link that is not genuine", async () => {
    const ctx = setup();
    expect(await ctx.service.unsubscribe("junk")).toBe(false);
    expect(await ctx.service.unsubscribePreview("junk")).toBeNull();
  });
});

describe("VisitorSaleAlertService settings link-up", () => {
  it("offers nothing without a verified address or without a sign-up", async () => {
    expect(await setup(null).service.settingsState("u1")).toBe("none");
    const unverified = setup({ email: "ada@example.com", verified: false });
    await signUp(unverified);
    expect(await unverified.service.settingsState("u1")).toBe("none");
    expect(await unverified.service.linkToClient("u1")).toBe(false);
  });

  it("shows a pending sign-up as pending and a confirmed one as on, then linked", async () => {
    const ctx = setup({ email: "Ada@example.com", verified: true });
    const { confirm } = await signUp(ctx);
    expect(await ctx.service.settingsState("u1")).toBe("pending");
    expect(await ctx.service.linkToClient("u1")).toBe(false);

    await ctx.service.confirm(confirm);
    expect(await ctx.service.settingsState("u1")).toBe("on");
    expect(await ctx.service.linkToClient("u1")).toBe(true);
    expect(await ctx.service.settingsState("u1")).toBe("linked");
  });

  it("turns the alerts off for the client's own address", async () => {
    const ctx = setup({ email: "ada@example.com", verified: true });
    const { confirm } = await signUp(ctx);
    await ctx.service.confirm(confirm);
    await ctx.service.stopForClient("u1");
    expect(await ctx.service.settingsState("u1")).toBe("none");
  });
});
