import type { EmailBlockRecord, IEmailBlockRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../../domain-event-sink.js";
import { NoAlertSubscriptionReader } from "./alert-subscription-reader.js";
import { type LiftEmailBlockRequest, LiftEmailBlockService } from "./lift-email-block.service.js";

const SINCE = new Date("2026-11-01T10:00:00.000Z");

function setup(block: EmailBlockRecord | null) {
  let current = block;
  const published: Array<Record<string, unknown>> = [];
  const resets: string[] = [];
  const blocks: IEmailBlockRepository = {
    findByHash: async () => current,
    findUserIdByHash: async () => "u1",
    removeIfUnchangedInTransaction: async (_tx, input) => {
      if (!current || current.since.getTime() !== input.expectedSince.getTime()) return null;
      const removed = current;
      current = null;
      return removed;
    },
    resetAddressStatusInTransaction: async (_tx, userId) => {
      resets.push(userId);
    },
    findLatestLift: async () => ({
      at: new Date("2026-11-02T09:00:00Z"),
      byUserId: "s2",
      byName: "Sam",
    }),
  };
  const events: IDomainEventSink = {
    publish: async (event) => {
      published.push(event as unknown as Record<string, unknown>);
    },
    withTx: () => events,
  };
  const reactivation = { request: vi.fn().mockResolvedValue(undefined) };
  const service = new LiftEmailBlockService({
    blocks,
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    events,
    reactivation,
  });
  return { service, published, resets, reactivation, current: () => current };
}

const block = (reason: EmailBlockRecord["reason"]): EmailBlockRecord => ({
  emailHash: "hash",
  reason,
  since: SINCE,
});

const request = (over: Partial<LiftEmailBlockRequest> = {}): LiftEmailBlockRequest => ({
  emailHash: "hash",
  userId: "u1",
  actor: { userId: "s1", canLift: true, isEmailAdmin: false },
  reason: "mailbox_fixed",
  expectedSince: SINCE,
  ...over,
});

describe("LiftEmailBlockService", () => {
  it("lifts a bounce, resets the status, audits it and queues the provider", async () => {
    const t = setup(block("hard_bounce"));
    const out = await t.service.lift(request());
    expect(out).toEqual({ ok: true, provider: { status: "queued" } });
    expect(t.current()).toBeNull();
    expect(t.resets).toEqual(["u1"]);
    expect(t.reactivation.request).toHaveBeenCalledWith({ userId: "u1", emailHash: "hash" });
    expect(t.published).toEqual([
      expect.objectContaining({
        eventType: "email.block_lifted",
        aggregateId: "u1",
        actorUserId: "s1",
        payload: {
          userId: "u1",
          reason: "mailbox_fixed",
          previousReason: "hard_bounce",
          previousSince: SINCE.toISOString(),
          provider: "queued",
        },
      }),
    ]);
  });

  it("answers 409 style when the block was already lifted, naming who got there first", async () => {
    const t = setup(null);
    const out = await t.service.lift(request());
    expect(out).toMatchObject({
      ok: false,
      error: "block_already_lifted",
      lifted: { byName: "Sam" },
    });
    expect(t.published).toEqual([]);
  });

  it("refuses when a newer block replaced the one the caller saw", async () => {
    const t = setup({ ...block("hard_bounce"), since: new Date("2026-11-02T00:00:00Z") });
    const out = await t.service.lift(request());
    expect(out).toMatchObject({ ok: false, error: "block_changed" });
    expect(t.published).toEqual([]);
    expect(t.resets).toEqual([]);
  });

  it("refuses to lift an unsubscribe, even for an administrator", async () => {
    const t = setup(block("unsubscribe"));
    const out = await t.service.lift(
      request({
        actor: { userId: "s1", canLift: true, isEmailAdmin: true },
        reason: "other",
        note: "x",
      }),
    );
    expect(out).toEqual({ ok: false, error: "refused", refusal: "unsubscribe_not_liftable" });
    expect(t.current()).not.toBeNull();
    expect(t.published).toEqual([]);
    expect(t.reactivation.request).not.toHaveBeenCalled();
  });

  it("keeps a complaint for administrators", async () => {
    const t = setup(block("complaint"));
    const out = await t.service.lift(
      request({ reason: "asked_to_receive_again", note: "Email of 2 Nov", writtenRequest: true }),
    );
    expect(out).toEqual({ ok: false, error: "refused", refusal: "administrator_only" });
    expect(t.current()).not.toBeNull();
  });

  it("requires the reason, note and written request the block's rule asks for", async () => {
    const admin = { userId: "s1", canLift: true, isEmailAdmin: true };
    const t = setup(block("hard_bounce"));
    expect(await t.service.lift(request({ reason: "other" }))).toMatchObject({
      refusal: "note_required",
    });
    const c = setup(block("complaint"));
    expect(
      await c.service.lift(request({ actor: admin, reason: "asked_to_receive_again", note: "n" })),
    ).toMatchObject({ refusal: "written_request_required" });
    expect(c.published).toEqual([]);
  });

  it("lifts a complaint without asking Postmark, and says Postmark still blocks the address", async () => {
    const t = setup(block("complaint"));
    const out = await t.service.lift(
      request({
        actor: { userId: "s1", canLift: true, isEmailAdmin: true },
        reason: "asked_to_receive_again",
        note: "Email of 2 Nov",
        writtenRequest: true,
      }),
    );
    expect(out).toEqual({
      ok: true,
      provider: { status: "still_blocked", message: "Postmark still blocks this address" },
    });
    expect(t.reactivation.request).not.toHaveBeenCalled();
    expect(t.published[0]).toMatchObject({
      payload: expect.objectContaining({ previousReason: "complaint", provider: "still_blocked" }),
    });
  });

  it("does not queue the provider for repeated soft bounces, which Postmark never blocked", async () => {
    const t = setup(block("soft_bounce_threshold"));
    const out = await t.service.lift(request());
    expect(out).toEqual({ ok: true, provider: { status: "not_needed" } });
    expect(t.reactivation.request).not.toHaveBeenCalled();
  });

  it("still lifts when the address is not tied to a person, without a provider request", async () => {
    const t = setup(block("manual"));
    const out = await t.service.lift(request({ userId: null }));
    expect(out).toEqual({ ok: true, provider: { status: "not_needed" } });
    expect(t.resets).toEqual([]);
    expect(t.published[0]).toMatchObject({ aggregateId: "hash" });
  });
});

describe("alerts after a complaint lift", () => {
  it("leaves alert topics stopped: the lift service is given no way to change them", async () => {
    const topics = new Map([["bid-alerts", "stopped_after_complaint"]]);
    const alerts = new NoAlertSubscriptionReader();
    const t = setup(block("complaint"));
    const before = [...topics];
    const out = await t.service.lift(
      request({
        actor: { userId: "s1", canLift: true, isEmailAdmin: true },
        reason: "asked_to_receive_again",
        note: "Email of 2 Nov",
        writtenRequest: true,
      }),
    );
    expect(out.ok).toBe(true);
    expect([...topics]).toEqual(before);
    // The alert reader reports nothing until the alert engine supplies one.
    expect(await alerts.stateFor()).toBeNull();
    // Only the audit entry was written; nothing alert-related.
    expect(t.published.map((e) => e.eventType)).toEqual(["email.block_lifted"]);
  });
});
