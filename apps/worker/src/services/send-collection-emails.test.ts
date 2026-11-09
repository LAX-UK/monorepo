import { COLLECTOR_EMAILS_PER_ADDRESS_PER_DAY } from "@auction/domain";
import { type EmailEnqueueInput, emailHash } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { enqueueCollectionEmails } from "./send-collection-emails.js";

const log = pino({ level: "silent" });
const NOW = new Date("2026-11-09T11:20:00Z");

const collectorNotice = (to: string, key = to): EmailEnqueueInput =>
  ({
    template: "collection-collector-notice",
    to,
    vars: {},
    category: "transactional",
    idempotencyKey: `n:${key}`,
  }) as EmailEnqueueInput;

const buyerEmail = (to: string): EmailEnqueueInput =>
  ({
    template: "collection-booked",
    to,
    vars: {},
    category: "transactional",
    idempotencyKey: `b:${to}`,
  }) as EmailEnqueueInput;

const collectorCancel = (to: string): EmailEnqueueInput =>
  ({
    template: "collection-cancelled",
    to,
    vars: { forCollector: { onBehalfOf: "Maya Okafor" } },
    category: "transactional",
    idempotencyKey: `c:${to}`,
  }) as EmailEnqueueInput;

function setup(alreadySent = 0) {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const collectorEmailsSince = vi.fn().mockResolvedValue(alreadySent);
  const run = (emails: EmailEnqueueInput[], cap?: number) =>
    enqueueCollectionEmails({
      emails,
      reader: { collectorEmailsSince },
      emailService: { enqueue },
      log,
      now: NOW,
      ...(cap === undefined ? {} : { cap }),
    });
  return { run, enqueue, collectorEmailsSince };
}

describe("collection emails to a named collector", () => {
  it("counts what the address was sent in the last 24 hours, by the hash the outbox keeps", async () => {
    const s = setup();
    await s.run([collectorNotice("Sam@Example.com")]);
    expect(s.collectorEmailsSince).toHaveBeenCalledWith(
      emailHash("Sam@Example.com"),
      new Date("2026-11-08T11:20:00Z"),
    );
  });

  it("sends up to the cap and no more, and says it skipped the rest", async () => {
    const s = setup();
    const result = await s.run(
      Array.from({ length: 8 }, (_, i) => collectorNotice("sam@example.com", `k${i}`)),
    );
    expect(COLLECTOR_EMAILS_PER_ADDRESS_PER_DAY).toBe(5);
    expect(result).toEqual({ queued: 5, skipped: 3 });
    expect(s.enqueue).toHaveBeenCalledTimes(5);
  });

  it("counts emails already queued earlier in the day", async () => {
    const s = setup(4);
    expect(
      await s.run([
        collectorNotice("sam@example.com", "a"),
        collectorNotice("sam@example.com", "b"),
      ]),
    ).toEqual({
      queued: 1,
      skipped: 1,
    });
  });

  it("holds an address that has reached the cap, but not a different address", async () => {
    const s = setup(5);
    expect(await s.run([collectorNotice("sam@example.com")])).toEqual({ queued: 0, skipped: 1 });
    s.collectorEmailsSince.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    expect(
      await s.run([collectorNotice("sam@example.com"), collectorNotice("lee@example.com")]),
    ).toEqual({ queued: 1, skipped: 1 });
  });

  it("applies to the cancellation sent to a collector too", async () => {
    const s = setup(5);
    expect(await s.run([collectorCancel("sam@example.com")])).toEqual({ queued: 0, skipped: 1 });
  });

  it("never holds back or counts the buyer's own emails", async () => {
    const s = setup(99);
    expect(await s.run([buyerEmail("maya@example.com")])).toEqual({ queued: 1, skipped: 0 });
    expect(s.collectorEmailsSince).not.toHaveBeenCalled();
  });

  it("takes the cap as a rule that can be set per call", async () => {
    const s = setup();
    expect(
      await s.run(
        [collectorNotice("sam@example.com", "a"), collectorNotice("sam@example.com", "b")],
        1,
      ),
    ).toEqual({ queued: 1, skipped: 1 });
  });
});
