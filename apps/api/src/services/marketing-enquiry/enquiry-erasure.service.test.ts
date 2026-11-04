import { describe, expect, it, vi } from "vitest";
import { EnquiryErasureService } from "./enquiry-erasure.service.js";

const counts = { enquiries: 2, notes: 1, attachments: 3, held: 1 };

function setup() {
  const tx = { tx: true };
  const anonymiseInTransaction = vi.fn().mockResolvedValue(counts);
  const publish = vi.fn().mockResolvedValue(undefined);
  const withTx = vi.fn(() => ({ publish }));
  const runInTransaction = vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
  const service = new EnquiryErasureService({
    erasure: { anonymiseInTransaction },
    transactionRunner: { runInTransaction } as never,
    events: { withTx, publish } as never,
  });
  return { service, tx, anonymiseInTransaction, publish, withTx, runInTransaction };
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
    expect(result).toEqual({ ok: true, ...counts });
    expect(anonymiseInTransaction).toHaveBeenCalledWith(tx, {
      kind: "email",
      email: "ada@example.com",
    });
    expect(withTx).toHaveBeenCalledWith(tx);
    const event = publish.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      eventType: "marketing_enquiry.erased",
      actorUserId: "staff_1",
      payload: { ...counts, reason: "Asked to be forgotten" },
    });
    expect(JSON.stringify(event)).not.toContain("ada@");
  });

  it("changes nothing when the confirmation does not match", async () => {
    const { service, runInTransaction } = setup();
    expect(await service.eraseByEmail({ ...input, confirmation: "other@example.com" })).toEqual({
      ok: false,
      error: "confirmation_mismatch",
    });
    expect(runInTransaction).not.toHaveBeenCalled();
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
      ok: true,
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 1,
    });
  });
});
