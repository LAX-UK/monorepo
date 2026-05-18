import type { MarketingEvent } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { EventMarketingConsentGate } from "../infrastructure/header-marketing-consent.gate.js";
import { MarketingEventService } from "./marketing-event.service.js";

const baseEvent: MarketingEvent = {
  name: "AddToWishlist",
  eventId: "evt_1",
  eventTime: 1_700_000_000,
  actionSource: "website",
  userIdOrAnon: { kind: "user", userId: "user-1" },
  consent: { marketing: true, analytics: true, basis: "consent" },
  customData: { lotId: "lot-1" },
};

const mockTx = {} as Parameters<MarketingEventService["stage"]>[1];

describe("MarketingEventService", () => {
  it("skips emit when consent gate denies", async () => {
    const outbox = {
      append: vi.fn(),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn().mockResolvedValue(undefined),
    };
    const queue = { enqueue: vi.fn() };
    const gate = { isAllowed: () => false };
    const svc = new MarketingEventService(outbox, queue, gate);
    await svc.emit(baseEvent);
    expect(outbox.markSkipped).toHaveBeenCalledWith(baseEvent, "consent_denied");
    expect(outbox.append).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("emit appends and enqueues when allowed", async () => {
    const outbox = {
      append: vi.fn().mockResolvedValue(true),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn(),
    };
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const svc = new MarketingEventService(outbox, queue, new EventMarketingConsentGate());
    await svc.emit(baseEvent);
    expect(outbox.append).toHaveBeenCalledWith(baseEvent);
    expect(queue.enqueue).toHaveBeenCalledWith(baseEvent);
  });

  it("stage appends in transaction without enqueueing", async () => {
    const outbox = {
      append: vi.fn().mockResolvedValue(true),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn(),
    };
    const queue = { enqueue: vi.fn() };
    const svc = new MarketingEventService(outbox, queue, new EventMarketingConsentGate());
    await svc.stage(baseEvent, mockTx);
    expect(outbox.append).toHaveBeenCalledWith(baseEvent, mockTx);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("stage records skipped when consent gate denies", async () => {
    const outbox = {
      append: vi.fn(),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn().mockResolvedValue(undefined),
    };
    const queue = { enqueue: vi.fn() };
    const gate = { isAllowed: () => false };
    const svc = new MarketingEventService(outbox, queue, gate);
    await svc.stage(baseEvent, mockTx);
    expect(outbox.markSkipped).toHaveBeenCalledWith(baseEvent, "consent_denied", mockTx);
    expect(outbox.append).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("emit skips enqueue when append is duplicate", async () => {
    const outbox = {
      append: vi.fn().mockResolvedValue(false),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn(),
    };
    const queue = { enqueue: vi.fn() };
    const svc = new MarketingEventService(outbox, queue, new EventMarketingConsentGate());
    await svc.emit(baseEvent);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("enqueue only pushes to queue", async () => {
    const outbox = {
      append: vi.fn(),
      claim: vi.fn(),
      ack: vi.fn(),
      fail: vi.fn(),
      markSkipped: vi.fn(),
    };
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const svc = new MarketingEventService(outbox, queue, new EventMarketingConsentGate());
    await svc.enqueue(baseEvent);
    expect(queue.enqueue).toHaveBeenCalledWith(baseEvent);
    expect(outbox.append).not.toHaveBeenCalled();
  });
});
