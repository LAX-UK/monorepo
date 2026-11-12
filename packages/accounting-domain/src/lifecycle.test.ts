import { describe, expect, it } from "vitest";
import {
  type DocumentRecord,
  type Lease,
  STATUSES,
  type Status,
  applyLookup,
  cancel,
  completeSending,
  escalate,
  expireLease,
  isLeaseExpired,
  newRecord,
  requeue,
  startSending,
} from "./lifecycle.js";
import type { IssueOutcome, LookupOutcome } from "./ports.js";

const NOW = 1_000_000;
const lease: Lease = { token: "t1", expiresAtMs: NOW + 60_000 };
const issuedOutcome: IssueOutcome = {
  status: "issued",
  number: "INV-1",
  providerId: "p1",
  pdfRef: null,
};
const found: LookupOutcome = { status: "found", number: "INV-1", providerId: "p1", pdfRef: "pdf" };

function rec(status: Status, over: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    ...newRecord("invoice", "LAX-INV-1"),
    status,
    lease: status === "sending" ? lease : null,
    lookupRequired: status === "unknown",
    ...over,
  };
}

function statusAfter(r: { ok: boolean; value?: DocumentRecord }): Status | "refused" {
  return r.ok && r.value ? r.value.status : "refused";
}

describe("startSending", () => {
  it("pending -> sending, takes the lease and counts the attempt", () => {
    const r = startSending(newRecord("invoice", "LAX-INV-1"), lease, NOW);
    expect(r).toMatchObject({ ok: true, value: { status: "sending", lease, attempts: 1 } });
  });
  it("refuses every other status", () => {
    const expected: Record<Status, string> = {
      pending: "sending",
      sending: "refused",
      issued: "refused",
      unknown: "refused", // lookup owed
      needs_review: "refused",
      failed: "refused",
      cancelled: "refused",
    };
    for (const s of STATUSES)
      expect(statusAfter(startSending(rec(s), lease, NOW))).toBe(expected[s]);
  });
  it("unknown is refused with lookup_required until a lookup rules the document out", () => {
    expect(startSending(rec("unknown"), lease, NOW)).toMatchObject({
      refusal: { code: "lookup_required" },
    });
    const looked = applyLookup(rec("unknown"), { status: "not_found" });
    if (!looked.ok) throw new Error("lookup");
    expect(startSending(looked.value, lease, NOW)).toMatchObject({
      ok: true,
      value: { status: "sending" },
    });
  });
  it("a held lease is reported as such", () => {
    expect(startSending(rec("sending"), lease, NOW)).toMatchObject({
      refusal: { code: "lease_held" },
    });
  });
  it("refuses an empty token or a lease already expired", () => {
    expect(startSending(rec("pending"), { token: "", expiresAtMs: NOW + 1 }, NOW)).toMatchObject({
      refusal: { code: "bad_lease" },
    });
    expect(startSending(rec("pending"), { token: "t", expiresAtMs: NOW }, NOW)).toMatchObject({
      refusal: { code: "bad_lease" },
    });
  });
});

describe("expireLease", () => {
  it("an expired lease means unknown, with a lookup owed", () => {
    const r = expireLease(rec("sending"), lease.expiresAtMs);
    expect(r).toMatchObject({
      ok: true,
      value: { status: "unknown", lease: null, lookupRequired: true },
    });
    expect(isLeaseExpired(lease, lease.expiresAtMs - 1)).toBe(false);
  });
  it("refuses a live lease and every non-sending status", () => {
    expect(expireLease(rec("sending"), NOW)).toMatchObject({ refusal: { code: "lease_held" } });
    for (const s of STATUSES.filter((x) => x !== "sending")) {
      expect(statusAfter(expireLease(rec(s), NOW + 10 ** 9))).toBe("refused");
    }
  });
});

describe("completeSending", () => {
  it("issued -> issued, keeps number, provider id and pdf", () => {
    expect(completeSending(rec("sending"), "t1", issuedOutcome, NOW)).toMatchObject({
      ok: true,
      value: {
        status: "issued",
        lease: null,
        issued: { number: "INV-1", providerId: "p1", pdfRef: null },
      },
    });
  });
  it("rejected -> failed with the reason", () => {
    expect(
      completeSending(rec("sending"), "t1", { status: "rejected", reason: "bad VAT" }, NOW),
    ).toMatchObject({
      ok: true,
      value: { status: "failed", failureReason: "bad VAT", lookupRequired: false },
    });
  });
  it("unknown / timeout -> unknown with lookup owed", () => {
    expect(completeSending(rec("sending"), "t1", { status: "unknown" }, NOW)).toMatchObject({
      ok: true,
      value: { status: "unknown", lookupRequired: true },
    });
  });
  it("an answer after the lease expired is not trusted, even a success", () => {
    expect(completeSending(rec("sending"), "t1", issuedOutcome, lease.expiresAtMs)).toMatchObject({
      ok: true,
      value: { status: "unknown", lookupRequired: true, issued: null },
    });
  });
  it("refuses a wrong token and every non-sending status", () => {
    expect(completeSending(rec("sending"), "other", issuedOutcome, NOW)).toMatchObject({
      refusal: { code: "lease_mismatch" },
    });
    for (const s of STATUSES.filter((x) => x !== "sending")) {
      expect(statusAfter(completeSending(rec(s), "t1", issuedOutcome, NOW))).toBe("refused");
    }
  });
});

describe("applyLookup", () => {
  it("found -> issued from unknown, with the provider's identity", () => {
    expect(applyLookup(rec("unknown"), found)).toMatchObject({
      ok: true,
      value: {
        status: "issued",
        lookupRequired: false,
        issued: { number: "INV-1", pdfRef: "pdf" },
      },
    });
  });
  it("not_found stays unknown but clears the duty, so a retry is allowed", () => {
    expect(applyLookup(rec("unknown"), { status: "not_found" })).toMatchObject({
      ok: true,
      value: { status: "unknown", lookupRequired: false },
    });
  });
  it("ambiguous -> needs_review, and the lookup is still owed", () => {
    expect(applyLookup(rec("unknown"), { status: "ambiguous", count: 2 })).toMatchObject({
      ok: true,
      value: { status: "needs_review", lookupRequired: true },
    });
  });
  it("unavailable changes nothing", () => {
    const r = rec("unknown");
    expect(applyLookup(r, { status: "unavailable", reason: "429" })).toEqual({
      ok: true,
      value: r,
    });
  });
  it("a review that still owes a lookup can be resolved by one", () => {
    expect(statusAfter(applyLookup(rec("needs_review", { lookupRequired: true }), found))).toBe(
      "issued",
    );
  });
  it("refuses when no lookup is owed", () => {
    for (const s of STATUSES) {
      if (s === "unknown") continue;
      expect(statusAfter(applyLookup(rec(s), found))).toBe("refused");
    }
    expect(applyLookup(rec("unknown", { lookupRequired: false }), found)).toMatchObject({
      refusal: { code: "bad_lookup_state" },
    });
  });
});

describe("escalate, requeue, cancel", () => {
  it("escalate: unknown and failed -> needs_review; others refused", () => {
    for (const s of STATUSES) {
      expect(statusAfter(escalate(rec(s), "check"))).toBe(
        s === "unknown" || s === "failed" ? "needs_review" : "refused",
      );
    }
    expect(escalate(rec("unknown"), "check")).toMatchObject({
      value: { lookupRequired: true, failureReason: "check" },
    });
  });
  it("requeue: failed -> pending; needs_review -> pending only with no lookup owed", () => {
    expect(requeue(rec("failed"))).toMatchObject({
      ok: true,
      value: { status: "pending", failureReason: null },
    });
    expect(requeue(rec("needs_review"))).toMatchObject({ ok: true, value: { status: "pending" } });
    expect(requeue(rec("needs_review", { lookupRequired: true }))).toMatchObject({
      refusal: { code: "lookup_required" },
    });
    for (const s of STATUSES.filter((x) => x !== "failed" && x !== "needs_review")) {
      expect(statusAfter(requeue(rec(s)))).toBe("refused");
    }
  });
  it("cancel: pending, failed and a settled review; never sending, issued or possibly-sent ones", () => {
    expect(statusAfter(cancel(rec("pending")))).toBe("cancelled");
    expect(statusAfter(cancel(rec("failed")))).toBe("cancelled");
    expect(statusAfter(cancel(rec("needs_review")))).toBe("cancelled");
    expect(cancel(rec("needs_review", { lookupRequired: true }))).toMatchObject({
      refusal: { code: "lookup_required" },
    });
    expect(cancel(rec("unknown"))).toMatchObject({ refusal: { code: "lookup_required" } });
    for (const s of ["sending", "issued", "cancelled"] as const)
      expect(statusAfter(cancel(rec(s)))).toBe("refused");
  });
});

describe("end to end", () => {
  it("timeout -> lookup finds it -> issued, with no second send", () => {
    let r = startSending(newRecord("invoice", "LAX-INV-9"), lease, NOW);
    if (!r.ok) throw new Error("start");
    r = completeSending(r.value, "t1", { status: "unknown", detail: "timeout" }, NOW + 1);
    if (!r.ok) throw new Error("complete");
    expect(startSending(r.value, { token: "t2", expiresAtMs: NOW + 9 }, NOW + 2).ok).toBe(false);
    r = applyLookup(r.value, found);
    expect(r).toMatchObject({ ok: true, value: { status: "issued", attempts: 1 } });
  });
  it("timeout -> lookup finds nothing -> retry sends again", () => {
    let r = startSending(newRecord("invoice", "LAX-INV-9"), lease, NOW);
    if (!r.ok) throw new Error("start");
    r = expireLease(r.value, lease.expiresAtMs);
    if (!r.ok) throw new Error("expire");
    r = applyLookup(r.value, { status: "not_found" });
    if (!r.ok) throw new Error("lookup");
    expect(
      startSending(
        r.value,
        { token: "t2", expiresAtMs: lease.expiresAtMs + 60_000 },
        lease.expiresAtMs + 1,
      ),
    ).toMatchObject({
      ok: true,
      value: { status: "sending", attempts: 2 },
    });
  });
});
