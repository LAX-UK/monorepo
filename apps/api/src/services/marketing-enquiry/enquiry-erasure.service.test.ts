import { describe, expect, it, vi } from "vitest";
import { EnquiryErasureService } from "./enquiry-erasure.service.js";

const counts = { enquiries: 2, notes: 1, attachments: 3, held: 1 };
const alertCounts = { alertSubscribers: 2, visitorSaleAlerts: 1, suppressionsKept: 1 };

function setup() {
  const tx = { tx: true };
  const anonymiseInTransaction = vi.fn().mockResolvedValue(counts);
  const eraseInTransaction = vi.fn().mockResolvedValue(alertCounts);
  const publish = vi.fn().mockResolvedValue(undefined);
  const withTx = vi.fn(() => ({ publish }));
  const runInTransaction = vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
  const service = new EnquiryErasureService({
    erasure: { anonymiseInTransaction },
    alertSubscribers: { eraseInTransaction },
    transactionRunner: { runInTransaction } as never,
    events: { withTx, publish } as never,
  });
  return {
    service,
    tx,
    eraseInTransaction,
    anonymiseInTransaction,
    publish,
    withTx,
    runInTransaction,
  };
}

const input = {
  email: " Ada@Example.com ",
  confirmation: "ada@example.com",
  reason: "Asked to be forgotten",
  actorUserId: "staff_1",
};

describe("EnquiryErasureService", () => {
  it("erases by the lower-cased address and audits counts and the reason, never the address", async () => {
    const { service, tx, anonymiseInTransaction, publish, withTx } = setup();
    const result = await service.eraseByEmail(input);
    expect(result).toEqual({ ok: true, ...counts, ...alertCounts });
    expect(anonymiseInTransaction).toHaveBeenCalledWith(tx, {
      kind: "email",
      email: "ada@example.com",
    });
    expect(withTx).toHaveBeenCalledWith(tx);
    const event = publish.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      eventType: "marketing_enquiry.erased",
      actorUserId: "staff_1",
      payload: { ...counts, ...alertCounts, reason: "Asked to be forgotten" },
    });
    expect(JSON.stringify(event)).not.toContain("ada@");
  });

  it("puts the data request's reference in the audit event when one asked for it", async () => {
    const { service, publish } = setup();
    await service.eraseByEmail({ ...input, requestReference: "DR-0007" });
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      payload: { ...counts, reason: "Asked to be forgotten", requestReference: "DR-0007" },
    });
    await service.eraseByEmail(input);
    expect(publish.mock.calls[1]?.[0].payload).not.toHaveProperty("requestReference");
  });

  it("erases the address's alert subscriptions in the same transaction, by normalised email", async () => {
    const { service, tx, eraseInTransaction } = setup();
    await service.eraseByEmail(input);
    expect(eraseInTransaction).toHaveBeenCalledTimes(1);
    expect(eraseInTransaction).toHaveBeenCalledWith(tx, { emails: ["ada@example.com"] });
  });

  it("is idempotent: a repeat with nothing left reports zero alert subscriptions", async () => {
    const { service, eraseInTransaction } = setup();
    eraseInTransaction.mockResolvedValue({
      alertSubscribers: 0,
      visitorSaleAlerts: 0,
      suppressionsKept: 0,
    });
    expect(await service.eraseByEmail(input)).toMatchObject({
      ok: true,
      alertSubscribers: 0,
      visitorSaleAlerts: 0,
    });
  });

  it("changes nothing when the confirmation does not match", async () => {
    const { service, runInTransaction, eraseInTransaction } = setup();
    expect(await service.eraseByEmail({ ...input, confirmation: "other@example.com" })).toEqual({
      ok: false,
      error: "confirmation_mismatch",
    });
    expect(runInTransaction).not.toHaveBeenCalled();
    expect(eraseInTransaction).not.toHaveBeenCalled();
  });

  it("requires a reason of sensible length", async () => {
    const { service, runInTransaction } = setup();
    for (const reason of ["  ", "no", "x".repeat(501)]) {
      expect(await service.eraseByEmail({ ...input, reason })).toEqual({
        ok: false,
        error: "reason_invalid",
      });
    }
    expect(runInTransaction).not.toHaveBeenCalled();
  });

  it("reports held enquiries without failing", async () => {
    const { service, anonymiseInTransaction } = setup();
    anonymiseInTransaction.mockResolvedValue({ enquiries: 0, notes: 0, attachments: 0, held: 1 });
    expect(await service.eraseByEmail(input)).toEqual({
      ...alertCounts,
      ok: true,
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 1,
    });
  });
});
