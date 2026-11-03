import { describe, expect, it, vi } from "vitest";
import { ZohoArtworkNoticeService } from "./zoho-artwork-notice.service.js";

const SECRET = "zoho-notice-secret-0123456789-abcdef"; // gitleaks:allow
const NOW = new Date("2026-11-03T10:00:30.000Z");

function setup(options: { secret?: string | undefined; enqueueFails?: boolean } = {}) {
  const stored = new Map<string, unknown>();
  const webhookEvents = {
    tryClaimEvent: vi.fn(async (input: { eventKey: string; payload: unknown }) => {
      if (stored.has(input.eventKey)) return { claimed: false };
      stored.set(input.eventKey, input.payload);
      return { claimed: true };
    }),
  };
  const producer = {
    enqueue: vi.fn(async () => {
      if (options.enqueueFails) throw new Error("redis down");
    }),
  };
  const service = new ZohoArtworkNoticeService(
    "secret" in options ? options.secret : SECRET,
    webhookEvents as never,
    producer,
    () => NOW,
  );
  return { service, webhookEvents, producer, stored };
}

const body = (value: unknown) => JSON.stringify(value);

describe("ZohoArtworkNoticeService", () => {
  it("answers 503 and stores nothing when no secret is configured", async () => {
    const { service, webhookEvents } = setup({ secret: undefined });
    const res = await service.handle(SECRET, body({ productId: "5001234567890" }));
    expect(res.status).toBe(503);
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret before reading the body", async () => {
    const { service, webhookEvents } = setup();
    expect((await service.handle(undefined, body({ productId: "5001234567890" }))).status).toBe(
      401,
    );
    expect((await service.handle("wrong", body({ productId: "5001234567890" }))).status).toBe(401);
    expect((await service.handle(`${SECRET}x`, body({ productId: "5001234567890" }))).status).toBe(
      401,
    );
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "nope"],
    ["no product id", body({ modifiedTime: "2026-11-03T10:00:00Z" })],
    ["a product id that is not a Zoho id", body({ productId: "abc' or 1=1" })],
    ["a JSON array", body([1, 2])],
  ])("rejects %s with 400", async (_label, raw) => {
    const { service, webhookEvents } = setup();
    expect((await service.handle(SECRET, raw)).status).toBe(400);
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("stores the notice and queues it once", async () => {
    const { service, webhookEvents, producer } = setup();
    const res = await service.handle(
      SECRET,
      body({ productId: "5001234567890", modifiedTime: "2026-11-03T09:59:00+00:00" }),
    );
    expect(res.status).toBe(202);
    expect(webhookEvents.tryClaimEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "zoho_artwork",
        payload: {
          body: { productId: "5001234567890", modifiedTime: "2026-11-03T09:59:00.000Z" },
          routing: { productId: "5001234567890", modifiedTime: "2026-11-03T09:59:00.000Z" },
        },
      }),
    );
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });

  it("treats the same product and modified time as one notice, however Zoho spells the time", async () => {
    const { service, producer, stored } = setup();
    await service.handle(
      SECRET,
      body({ productId: "5001234567890", modifiedTime: "2026-11-03T10:59:00+01:00" }),
    );
    const again = await service.handle(
      SECRET,
      body({ productId: "5001234567890", modifiedTime: "2026-11-03T09:59:00Z" }),
    );
    expect(again.status).toBe(202);
    expect(stored.size).toBe(1);
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });

  it("keeps notices for different modified times apart", async () => {
    const { service, producer, stored } = setup();
    await service.handle(
      SECRET,
      body({ productId: "5001234567890", modifiedTime: "2026-11-03T09:59:00Z" }),
    );
    await service.handle(
      SECRET,
      body({ productId: "5001234567890", modifiedTime: "2026-11-03T10:05:00Z" }),
    );
    expect(stored.size).toBe(2);
    expect(producer.enqueue).toHaveBeenCalledTimes(2);
  });

  it("groups notices without a modified time by minute", async () => {
    const { service, stored } = setup();
    await service.handle(SECRET, body({ productId: "5001234567890" }));
    await service.handle(SECRET, body({ productId: "5001234567890" }));
    expect(stored.size).toBe(1);
  });

  it("accepts a numeric product id", async () => {
    const { service, webhookEvents } = setup();
    expect((await service.handle(SECRET, body({ productId: 5001234567890 }))).status).toBe(202);
    expect(webhookEvents.tryClaimEvent).toHaveBeenCalled();
  });

  it("still answers 202 when queuing fails, because the notice is stored for the drain", async () => {
    const { service, stored } = setup({ enqueueFails: true });
    const res = await service.handle(SECRET, body({ productId: "5001234567890" }));
    expect(res.status).toBe(202);
    expect(stored.size).toBe(1);
  });
});
