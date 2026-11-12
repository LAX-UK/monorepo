import pino from "pino";
import { describe, expect, it, vi } from "vitest";

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@auction/observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@auction/observability")>();
  return { ...actual, Sentry: { ...actual.Sentry, captureMessage } };
});

import { INVOICE_GRACE_MS, runReofferSweepJob } from "./reoffer-sweep.js";

const log = pino({ level: "silent" });
const markerOf = () => ({ markInvoiceNotRaised: vi.fn(async () => true) });
const ref = (n: number) => ({ reofferId: `offer-${n}`, lotId: `lot-${n}` });

function readerOf(input: {
  requests?: number[];
  offers?: number[];
  missed?: number[];
}) {
  return {
    latestDefaultId: vi.fn(),
    openSellerRequests: vi.fn(async () => (input.requests ?? []).map(ref)),
    offersOut: vi.fn(async () => (input.offers ?? []).map(ref)),
    acceptedWithoutInvoice: vi.fn(async () => (input.missed ?? []).map(ref)),
  };
}

describe("runReofferSweepJob", () => {
  it("settles every request and offer and counts what happened", async () => {
    const clock = {
      settleSellerRequest: vi.fn(async (r: { reofferId: string }) =>
        r.reofferId === "offer-1" ? ("lapsed" as const) : ("reminded" as const),
      ),
      settleOffer: vi.fn(async (r: { reofferId: string }) =>
        r.reofferId === "offer-3" ? ("ended" as const) : ("waiting" as const),
      ),
    };
    const result = await runReofferSweepJob({
      reader: readerOf({ requests: [1, 2], offers: [3, 4] }),
      clock,
      marker: markerOf(),
      ensureInvoice: null,
      log,
    });
    expect(result).toEqual({
      lapsed: 1,
      requestReminders: 1,
      ended: 1,
      offerReminders: 0,
      invoicesRaised: 0,
      invoicesUnraised: 0,
      failed: 0,
    });
  });

  it("keeps going when one offer fails, and says so", async () => {
    const clock = {
      settleSellerRequest: vi.fn(async () => "waiting" as const),
      settleOffer: vi.fn(async (r: { reofferId: string }) => {
        if (r.reofferId === "offer-1") throw new Error("boom");
        return "ended" as const;
      }),
    };
    const result = await runReofferSweepJob({
      reader: readerOf({ offers: [1, 2] }),
      clock,
      marker: markerOf(),
      ensureInvoice: null,
      log,
    });
    expect(result.failed).toBe(1);
    expect(result.ended).toBe(1);
    expect(clock.settleOffer).toHaveBeenCalledTimes(2);
  });

  it("raises the invoice of a missed re-award, only for awards older than the grace period", async () => {
    const reader = readerOf({ missed: [1, 2] });
    const ensureInvoice = vi.fn(async (lotId: string) =>
      lotId === "lot-1" ? { created: true } : { created: false, reason: "payment_already_exists" },
    );
    const now = new Date("2026-11-10T12:00:00Z");
    const result = await runReofferSweepJob({
      reader,
      clock: { settleSellerRequest: vi.fn(), settleOffer: vi.fn() },
      marker: markerOf(),
      ensureInvoice,
      log,
      now: () => now,
    });
    expect(reader.acceptedWithoutInvoice).toHaveBeenCalledWith({
      reawardedBefore: new Date(now.getTime() - INVOICE_GRACE_MS),
      retryMarkedBefore: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      limit: 200,
    });
    expect(ensureInvoice.mock.calls.map(([id]) => id)).toEqual(["lot-1", "lot-2"]);
    expect(result.invoicesRaised).toBe(1);
  });

  it("does not look for missed invoices where invoices cannot be raised", async () => {
    const reader = readerOf({ missed: [1] });
    await runReofferSweepJob({
      reader,
      clock: { settleSellerRequest: vi.fn(), settleOffer: vi.fn() },
      marker: markerOf(),
      ensureInvoice: null,
      log,
    });
    expect(reader.acceptedWithoutInvoice).not.toHaveBeenCalled();
  });

  const sweepOnce = (reason: string | undefined, marker = markerOf(), warn = vi.fn()) =>
    runReofferSweepJob({
      reader: readerOf({ missed: [1] }),
      clock: { settleSellerRequest: vi.fn(), settleOffer: vi.fn() },
      marker,
      ensureInvoice: vi.fn(async () =>
        reason === undefined ? { created: false } : { created: false, reason },
      ),
      log: { ...log, info: vi.fn(), warn } as unknown as typeof log,
    });

  it.each([
    "payment_already_exists",
    "already_refunded",
    "lot_moved",
    "no_winner",
    "lot_not_found",
    "lot_not_ended",
    "missing_buyer_legal_entity",
  ])(
    "counts, logs and marks %s for good: an invoice exists or the award is gone",
    async (reason) => {
      const marker = markerOf();
      const warn = vi.fn();
      const result = await sweepOnce(reason, marker, warn);
      expect(result.invoicesUnraised).toBe(1);
      expect(result.invoicesRaised).toBe(0);
      expect(result.failed).toBe(0);
      expect(marker.markInvoiceNotRaised).toHaveBeenCalledWith(
        "offer-1",
        `invoice_not_raised:${reason}`,
      );
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ reofferId: "offer-1", lotId: "lot-1", reason, retry: false }),
        "reoffer_invoice_not_raised",
      );
    },
  );

  it.each([
    "missing_seller_legal_entity",
    "payment_amount_exceeds_limit",
    "invalid_payment_amount",
    "some_future_reason",
  ])("counts, logs and marks %s for a retry after the back-off, never for good", async (reason) => {
    const marker = markerOf();
    const warn = vi.fn();
    const result = await sweepOnce(reason, marker, warn);
    expect(result.invoicesUnraised).toBe(1);
    expect(result.failed).toBe(0);
    expect(marker.markInvoiceNotRaised).toHaveBeenCalledWith(
      "offer-1",
      `invoice_not_raised:retry:${reason}`,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason, retry: true }),
      "reoffer_invoice_not_raised",
    );
  });

  it("retries an unexplained refusal", async () => {
    const marker = markerOf();
    await sweepOnce(undefined, marker);
    expect(marker.markInvoiceNotRaised).toHaveBeenCalledWith(
      "offer-1",
      "invoice_not_raised:retry:unchanged",
    );
  });

  it("reports before it marks, so a crash at the mark cannot lose the report", async () => {
    captureMessage.mockClear();
    const marker = markerOf();
    const warn = vi.fn();
    await sweepOnce("missing_seller_legal_entity", marker, warn);
    const markAt = marker.markInvoiceNotRaised.mock.invocationCallOrder[0] ?? 0;
    expect(warn.mock.invocationCallOrder[0]).toBeLessThan(markAt);
    expect(captureMessage.mock.invocationCallOrder[0]).toBeLessThan(markAt);
  });

  it("does not mark a raised invoice", async () => {
    const marker = markerOf();
    await runReofferSweepJob({
      reader: readerOf({ missed: [1] }),
      clock: { settleSellerRequest: vi.fn(), settleOffer: vi.fn() },
      marker,
      ensureInvoice: vi.fn(async () => ({ created: true })),
      log,
    });
    expect(marker.markInvoiceNotRaised).not.toHaveBeenCalled();
  });

  it("reports a failed mark as a failed step, after the warning went out", async () => {
    captureMessage.mockClear();
    const result = await runReofferSweepJob({
      reader: readerOf({ missed: [1] }),
      clock: { settleSellerRequest: vi.fn(), settleOffer: vi.fn() },
      marker: { markInvoiceNotRaised: vi.fn(async () => Promise.reject(new Error("db down"))) },
      ensureInvoice: vi.fn(async () => ({ created: false, reason: "lot_not_found" })),
      log,
    });
    expect(result.failed).toBe(1);
    expect(result.invoicesUnraised).toBe(0);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("none can be raised"),
      expect.objectContaining({ level: "warning" }),
    );
  });
});
