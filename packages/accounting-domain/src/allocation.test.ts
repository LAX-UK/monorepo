import { describe, expect, it } from "vitest";
import { type OpenInvoice, allocatePayment } from "./allocation.js";
import { forAll, int } from "./testing/generate.js";

const inv = (reference: string, dueOn: string, outstandingPence: number): OpenInvoice => ({
  reference,
  dueOn,
  outstandingPence,
});

function plan(payment: number, invoices: OpenInvoice[]) {
  const r = allocatePayment(payment, invoices);
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

describe("allocatePayment", () => {
  it("pays the oldest due first and reports the remainder", () => {
    const p = plan(1000, [
      inv("B", "2026-02-01", 400),
      inv("A", "2026-01-01", 300),
      inv("C", "2026-03-01", 100),
    ]);
    expect(p.allocations).toEqual([
      { invoiceReference: "A", amountPence: 300 },
      { invoiceReference: "B", amountPence: 400 },
      { invoiceReference: "C", amountPence: 100 },
    ]);
    expect(p.unallocatedPence).toBe(200);
  });

  it("part-pays the last invoice it reaches and leaves later ones untouched", () => {
    const p = plan(500, [
      inv("A", "2026-01-01", 300),
      inv("B", "2026-02-01", 400),
      inv("C", "2026-03-01", 1),
    ]);
    expect(p.allocations).toEqual([
      { invoiceReference: "A", amountPence: 300 },
      { invoiceReference: "B", amountPence: 200 },
    ]);
    expect(p.unallocatedPence).toBe(0);
  });

  it("breaks due-date ties by reference and skips settled invoices", () => {
    const p = plan(50, [
      inv("Z", "2026-01-01", 30),
      inv("Y", "2026-01-01", 0),
      inv("X", "2026-01-01", 30),
    ]);
    expect(p.allocations.map((a) => a.invoiceReference)).toEqual(["X", "Z"]);
  });

  it("no invoices allocates nothing", () => {
    expect(plan(70, [])).toEqual({ allocations: [], unallocatedPence: 70 });
  });

  it("refuses a payment of zero", () => {
    expect(allocatePayment(0, [inv("A", "2026-01-01", 5)])).toMatchObject({
      ok: false,
      refusal: { code: "bad_amount" },
    });
  });

  it("refuses impossible due dates and orders by code unit, not locale", () => {
    expect(allocatePayment(10, [inv("A", "2026-02-30", 1)]).ok).toBe(false);
    expect(allocatePayment(10, [inv("A", "2026-13-45", 1)]).ok).toBe(false);
    const p = plan(100, [
      inv("a_b", "2026-01-01", 1),
      inv("B", "2026-01-01", 1),
      inv("A-b", "2026-01-01", 1),
    ]);
    expect(p.allocations.map((a) => a.invoiceReference)).toEqual(["A-b", "B", "a_b"]);
  });

  it.each([
    [-1, [], "bad_amount"],
    [1.5, [], "bad_amount"],
    [10, [inv("A", "2026-01-01", -1)], "bad_amount"],
    [10, [inv("A", "01/01/2026", 1)], "bad_due_date"],
    [10, [inv("A", "2026-01-01", 1), inv("A", "2026-01-02", 1)], "duplicate_invoice"],
  ])("refuses bad input %#", (payment, invoices, code) => {
    const r = allocatePayment(payment, invoices);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe(code);
  });

  it("property: conserves money, never over-allocates, stays oldest-first", () => {
    forAll(500, (rng) => {
      const invoices = Array.from({ length: int(rng, 0, 8) }, (_, i) =>
        inv(`R${i}`, `2026-0${int(rng, 1, 9)}-1${int(rng, 0, 9)}`, int(rng, 0, 100_000)),
      );
      const payment = int(rng, 1, 400_000);
      const p = plan(payment, invoices);
      const allocated = p.allocations.reduce((n, a) => n + a.amountPence, 0);
      expect(allocated + p.unallocatedPence).toBe(payment);
      for (const a of p.allocations) {
        const owed =
          invoices.find((i) => i.reference === a.invoiceReference)?.outstandingPence ?? 0;
        expect(a.amountPence).toBeGreaterThan(0);
        expect(a.amountPence).toBeLessThanOrEqual(owed);
      }
      if (p.unallocatedPence > 0) {
        // remainder exists only when every invoice is fully paid
        for (const i of invoices.filter((x) => x.outstandingPence > 0)) {
          expect(p.allocations.find((a) => a.invoiceReference === i.reference)?.amountPence).toBe(
            i.outstandingPence,
          );
        }
      }
      // any partly paid or unpaid invoice is never older than a fully paid one it follows
      const order = [...invoices].sort(
        (a, b) =>
          (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0) ||
          (a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0),
      );
      expect(p.allocations.map((a) => a.invoiceReference)).toEqual(
        order
          .map((o) => o.reference)
          .filter((r) => p.allocations.some((a) => a.invoiceReference === r)),
      );
    });
  });
});
