import { emailHash } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR,
  applyOptOutLiftEvent,
  processZohoCampaignsOptOutLift,
} from "./zoho-campaigns-opt-out-lift.js";

const log = pino({ level: "silent" });
const payload = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  emailHash: emailHash("client@example.com"),
  product: "shop",
  confirmedAt: "2026-11-03T09:00:00.000Z",
  ...over,
});

describe("applyOptOutLiftEvent", () => {
  it("lifts the address at the time the person confirmed", async () => {
    const repo = { liftOptOut: vi.fn(async () => true) };

    await applyOptOutLiftEvent(repo, { id: 1, payload: payload() }, log);

    expect(repo.liftOptOut).toHaveBeenCalledWith(
      emailHash("client@example.com"),
      new Date("2026-11-03T09:00:00.000Z"),
    );
  });

  it("drops an event that does not parse, without lifting anything", async () => {
    const repo = { liftOptOut: vi.fn(async () => true) };
    await applyOptOutLiftEvent(repo, { id: 2, payload: payload({ emailHash: "" }) }, log);
    await applyOptOutLiftEvent(
      repo,
      { id: 3, payload: payload({ confirmedAt: "yesterday" }) },
      log,
    );
    expect(repo.liftOptOut).not.toHaveBeenCalled();
  });
});

function ctxFor(
  rows: { id: number; eventType: string; aggregateId: string; payload: unknown }[],
  liftOptOut: ReturnType<typeof vi.fn>,
) {
  const advanceCursor = vi.fn();
  const listAfterCursor = vi.fn().mockResolvedValue(rows);
  const ctx = {
    projectorStateRepo: { getCursor: vi.fn().mockResolvedValue(10), advanceCursor },
    domainEventReader: { listAfterCursor },
    zohoCampaignsOptOutLiftRepo: { liftOptOut },
  } as unknown as ProjectorRunContext;
  return { ctx, advanceCursor, listAfterCursor };
}

describe("processZohoCampaignsOptOutLift", () => {
  const row = (id: number) => ({
    id,
    eventType: "alert.subscription.confirmed",
    aggregateId: "sub",
    payload: payload(),
  });

  it("reads only the confirmed-subscription events and advances past each lift", async () => {
    const liftOptOut = vi.fn(async () => true);
    const { ctx, advanceCursor, listAfterCursor } = ctxFor([row(11), row(12)], liftOptOut);

    await processZohoCampaignsOptOutLift({ ctx, log });

    expect(listAfterCursor).toHaveBeenCalledWith(10, {
      eventTypes: ["alert.subscription.confirmed"],
      limit: 100,
    });
    expect(liftOptOut).toHaveBeenCalledTimes(2);
    expect(advanceCursor).toHaveBeenCalledWith(ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR, 12);
  });

  it("stops at a failed lift and keeps the cursor before it, so it is tried again", async () => {
    const liftOptOut = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("db down"));
    const { ctx, advanceCursor } = ctxFor([row(11), row(12), row(13)], liftOptOut);

    await processZohoCampaignsOptOutLift({ ctx, log });

    expect(liftOptOut).toHaveBeenCalledTimes(2);
    expect(advanceCursor).toHaveBeenCalledWith(ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR, 11);
  });

  it("does nothing when there are no events", async () => {
    const { ctx, advanceCursor } = ctxFor([], vi.fn());
    await processZohoCampaignsOptOutLift({ ctx, log });
    expect(advanceCursor).not.toHaveBeenCalled();
  });
});
