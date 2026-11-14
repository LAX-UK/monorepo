import { describe, expect, it } from "vitest";
import {
  CLOCK_SKEW_MS,
  type DocumentRecord,
  type Lease,
  MAX_LEASE_MS,
  SETTLE_GRACE_MS,
  STATUSES,
  type Status,
  applyLookup,
  cancel,
  completeSending,
  escalate,
  expireLease,
  hold,
  isLeaseExpired,
  newRecord,
  parseRecord,
  release,
  requeue,
  startSending,
  withhold,
} from "./lifecycle.js";
import type { Totals } from "./money.js";
import type { IssueOutcome, LookupOutcome } from "./ports.js";
import { forAll, int, pick } from "./testing/generate.js";

const NOW = 1_000_000;
const lease: Lease = { token: "t1", expiresAtMs: NOW + 60_000 };
const SETTLED = lease.expiresAtMs + SETTLE_GRACE_MS;
const totals: Totals = { netPence: 10_000, vatPence: 2_000, grossPence: 12_000 };
const issuedOutcome: IssueOutcome = {
  status: "issued",
  number: "INV-1",
  providerId: "p1",
  pdfRef: null,
  totals,
};
const found: LookupOutcome = {
  status: "found",
  number: "INV-1",
  providerId: "p1",
  pdfRef: "pdf",
  totals,
};
const doc = { number: "INV-1", providerId: "p1", pdfRef: null };
const base = { kind: "invoice", reference: "LAX-SHOP-INV-1", attempts: 1 } as const;

function rec(status: Status): DocumentRecord {
  switch (status) {
    case "pending":
      return { ...base, status };
    case "sending":
      return { ...base, status, lease };
    case "issued":
      return { ...base, status, issued: doc };
    case "unknown":
      return { ...base, status, settlesAtMs: SETTLED };
    case "needs_review":
      return { ...base, status, lookup: "clear", issued: null, mismatch: null, reason: "r" };
    case "failed":
      return { ...base, status, reason: "r" };
    case "cancelled":
      return { ...base, status };
  }
}
const owedReview = (): DocumentRecord => ({
  ...base,
  status: "needs_review",
  lookup: "owed",
  settlesAtMs: SETTLED,
  reason: "r",
});

function statusAfter(r: { ok: boolean; value?: DocumentRecord }): Status | "refused" {
  return r.ok && r.value ? r.value.status : "refused";
}
function must<T>(r: { ok: boolean; value?: T }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value as T;
}

describe("startSending", () => {
  it("pending -> sending, takes the lease and counts the attempt", () => {
    const r = startSending(newRecord("invoice", "LAX-SHOP-INV-1"), lease, NOW);
    expect(r).toMatchObject({ ok: true, value: { status: "sending", lease, attempts: 1 } });
  });
  it("refuses every other status", () => {
    for (const s of STATUSES.filter((x) => x !== "pending")) {
      expect(statusAfter(startSending(rec(s), lease, NOW))).toBe("refused");
    }
    expect(statusAfter(startSending(owedReview(), lease, NOW))).toBe("refused");
  });
  it("an unknown record is refused with lookup_required, and a settled not_found makes it pending", () => {
    expect(startSending(rec("unknown"), lease, NOW)).toMatchObject({
      refusal: { code: "lookup_required" },
    });
    const looked = must(applyLookup(rec("unknown"), { status: "not_found" }, SETTLED, totals));
    expect(looked.status).toBe("pending");
    expect(
      startSending(looked, { token: "t9", expiresAtMs: SETTLED + 60_000 }, SETTLED),
    ).toMatchObject({
      ok: true,
      value: { status: "sending" },
    });
  });
  it("a held lease is reported as such", () => {
    expect(startSending(rec("sending"), lease, NOW)).toMatchObject({
      refusal: { code: "lease_held" },
    });
  });
  it("refuses an empty token, an expired lease and one longer than the maximum", () => {
    const pending = rec("pending");
    for (const l of [
      { token: "", expiresAtMs: NOW + 1 },
      { token: "t", expiresAtMs: NOW },
      { token: "t", expiresAtMs: NOW + MAX_LEASE_MS + 1 },
    ]) {
      expect(startSending(pending, l, NOW)).toMatchObject({ refusal: { code: "bad_lease" } });
    }
    expect(startSending(pending, { token: "t", expiresAtMs: NOW + MAX_LEASE_MS }, NOW).ok).toBe(
      true,
    );
  });
  it("refuses NaN, Infinity and fractional times: a lease can never be un-expirable", () => {
    const pending = rec("pending");
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1000.5, -1, 2 ** 60]) {
      expect(startSending(pending, { token: "t", expiresAtMs: bad }, NOW)).toMatchObject({
        refusal: { code: "bad_time" },
      });
      expect(startSending(pending, lease, bad)).toMatchObject({ refusal: { code: "bad_time" } });
    }
  });
});

describe("expireLease", () => {
  it("an expired lease means unknown, with the settle time set", () => {
    expect(expireLease(rec("sending"), lease.expiresAtMs)).toMatchObject({
      ok: true,
      value: { status: "unknown", settlesAtMs: SETTLED },
    });
    expect(isLeaseExpired(lease, lease.expiresAtMs - 1)).toBe(false);
  });
  it("refuses a live lease, a bad clock and every non-sending status", () => {
    expect(expireLease(rec("sending"), NOW)).toMatchObject({ refusal: { code: "lease_held" } });
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(expireLease(rec("sending"), bad)).toMatchObject({ refusal: { code: "bad_time" } });
    }
    for (const s of STATUSES.filter((x) => x !== "sending")) {
      expect(statusAfter(expireLease(rec(s), NOW + 10 ** 9))).toBe("refused");
    }
  });
});

describe("completeSending", () => {
  it("issued with matching totals -> issued, keeps number, provider id and pdf", () => {
    expect(completeSending(rec("sending"), "t1", issuedOutcome, NOW, totals)).toMatchObject({
      ok: true,
      value: { status: "issued", issued: { number: "INV-1", providerId: "p1", pdfRef: null } },
    });
  });
  it("a one-penny difference in any total goes to needs_review and keeps the provider identity", () => {
    for (const field of ["netPence", "vatPence", "grossPence"] as const) {
      const theirs = { ...totals, [field]: totals[field] + 1 };
      const r = must(
        completeSending(rec("sending"), "t1", { ...issuedOutcome, totals: theirs }, NOW, totals),
      );
      expect(r).toMatchObject({
        status: "needs_review",
        lookup: "clear",
        issued: { number: "INV-1", providerId: "p1" },
        mismatch: { field, differencePence: 1 },
      });
    }
  });
  it("a mismatched document can never be sent, requeued or cancelled", () => {
    const r = must(
      completeSending(
        rec("sending"),
        "t1",
        { ...issuedOutcome, totals: { ...totals, grossPence: 12_001 } },
        NOW,
        totals,
      ),
    );
    expect(statusAfter(startSending(r, lease, NOW))).toBe("refused");
    expect(statusAfter(requeue(r))).toBe("refused");
    expect(statusAfter(cancel(r))).toBe("refused");
    expect(statusAfter(escalate(r, "x"))).toBe("refused");
  });
  it("a document that differs on read-back goes to a person, identity kept, never failed", () => {
    const differs: IssueOutcome = {
      ...issuedOutcome,
      status: "differs",
      reason: "zoho_books_payment_mismatch",
    };
    const r = must(completeSending(rec("sending"), "t1", differs, NOW, totals));
    expect(r).toEqual({
      ...base,
      status: "needs_review",
      lookup: "clear",
      issued: doc,
      mismatch: null,
      reason: "provider document differs from ours: zoho_books_payment_mismatch",
    });
    expect(statusAfter(startSending(r, lease, NOW))).toBe("refused");
    expect(statusAfter(requeue(r))).toBe("refused");
    expect(statusAfter(cancel(r))).toBe("refused");
    expect(statusAfter(escalate(r, "x"))).toBe("refused");
  });
  it("a differing document keeps a totals difference too", () => {
    const theirs = { ...totals, grossPence: 11_999 };
    const outcome: IssueOutcome = {
      ...issuedOutcome,
      status: "differs",
      reason: "x",
      totals: theirs,
    };
    const r = must(completeSending(rec("sending"), "t1", outcome, NOW, totals));
    expect(r).toMatchObject({
      status: "needs_review",
      mismatch: { field: "grossPence", differencePence: -1 },
    });
  });
  it("a differing document with unreadable totals or no reason changes nothing", () => {
    const bad = (outcome: IssueOutcome) =>
      completeSending(rec("sending"), "t1", outcome, NOW, totals);
    const fractional = { ...totals, netPence: 1.5 };
    expect(
      bad({ ...issuedOutcome, status: "differs", reason: "x", totals: fractional }),
    ).toMatchObject({ ok: false, refusal: { code: "bad_outcome" } });
    expect(bad({ ...issuedOutcome, status: "differs", reason: "" })).toMatchObject({
      ok: false,
      refusal: { code: "bad_outcome" },
    });
  });
  it("a differing answer after the lease expired still goes to a person, never to a lookup", () => {
    // As unknown, a lookup by reference would find the document with our totals and record it
    // issued, and the difference Books reported would be lost.
    const outcome: IssueOutcome = { ...issuedOutcome, status: "differs", reason: "x" };
    const late = must(completeSending(rec("sending"), "t1", outcome, lease.expiresAtMs, totals));
    expect(late).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: doc,
      reason: "provider document differs from ours: x",
    });
    expect(statusAfter(requeue(late))).toBe("refused");
    expect(
      completeSending(rec("sending"), "other", outcome, lease.expiresAtMs, totals),
    ).toMatchObject({ ok: false, refusal: { code: "lease_mismatch" } });
  });
  it("rejected -> failed with the reason", () => {
    expect(
      completeSending(rec("sending"), "t1", { status: "rejected", reason: "bad VAT" }, NOW, totals),
    ).toMatchObject({ ok: true, value: { status: "failed", reason: "bad VAT" } });
  });
  it("unknown / timeout -> unknown, settling after the lease plus grace", () => {
    expect(completeSending(rec("sending"), "t1", { status: "unknown" }, NOW, totals)).toMatchObject(
      { ok: true, value: { status: "unknown", settlesAtMs: SETTLED } },
    );
  });
  it("an answer after the lease expired is not trusted, even a success", () => {
    expect(
      completeSending(rec("sending"), "t1", issuedOutcome, lease.expiresAtMs, totals),
    ).toMatchObject({ ok: true, value: { status: "unknown", settlesAtMs: SETTLED } });
  });
  it("refuses a wrong token, a bad clock and every non-sending status", () => {
    expect(completeSending(rec("sending"), "other", issuedOutcome, NOW, totals)).toMatchObject({
      refusal: { code: "lease_mismatch" },
    });
    expect(completeSending(rec("sending"), "t1", issuedOutcome, Number.NaN, totals)).toMatchObject({
      refusal: { code: "bad_time" },
    });
    for (const s of STATUSES.filter((x) => x !== "sending")) {
      expect(statusAfter(completeSending(rec(s), "t1", issuedOutcome, NOW, totals))).toBe(
        "refused",
      );
    }
  });
  it("a late answer is distrusted even with an Infinity-like clock", () => {
    expect(completeSending(rec("sending"), "t1", issuedOutcome, 1e15, totals)).toMatchObject({
      ok: true,
      value: { status: "unknown" },
    });
    expect(completeSending(rec("sending"), "t1", issuedOutcome, 2 ** 60, totals)).toMatchObject({
      refusal: { code: "bad_time" },
    });
  });
});

describe("applyLookup", () => {
  it("found with matching totals -> issued, with the provider's identity", () => {
    expect(applyLookup(rec("unknown"), found, NOW, totals)).toMatchObject({
      ok: true,
      value: { status: "issued", issued: { number: "INV-1", pdfRef: "pdf" } },
    });
  });
  it("found with different totals -> needs_review, identity kept, nothing owed", () => {
    for (const status of ["unknown", "owed"] as const) {
      const r = applyLookup(
        status === "unknown" ? rec("unknown") : owedReview(),
        { ...found, totals: { ...totals, grossPence: 12_001 } },
        NOW,
        totals,
      );
      expect(r).toMatchObject({
        ok: true,
        value: {
          status: "needs_review",
          lookup: "clear",
          issued: { providerId: "p1" },
          mismatch: { field: "grossPence", differencePence: 1 },
        },
      });
    }
  });
  it("not_found before the first request has settled is refused", () => {
    expect(applyLookup(rec("unknown"), { status: "not_found" }, SETTLED - 1, totals)).toMatchObject(
      {
        refusal: { code: "lookup_too_early" },
      },
    );
    expect(applyLookup(owedReview(), { status: "not_found" }, SETTLED - 1, totals)).toMatchObject({
      refusal: { code: "lookup_too_early" },
    });
  });
  it("not_found after it has settled: unknown -> pending; a review is cleared of its duty", () => {
    expect(applyLookup(rec("unknown"), { status: "not_found" }, SETTLED, totals)).toMatchObject({
      ok: true,
      value: { status: "pending", attempts: 1 },
    });
    expect(applyLookup(owedReview(), { status: "not_found" }, SETTLED, totals)).toMatchObject({
      ok: true,
      value: { status: "needs_review", lookup: "clear", issued: null },
    });
  });
  it("found is believed at any time: the document exists", () => {
    expect(statusAfter(applyLookup(rec("unknown"), found, 0, totals))).toBe("issued");
  });
  it("ambiguous -> needs_review, and the lookup is still owed", () => {
    expect(
      applyLookup(rec("unknown"), { status: "ambiguous", count: 2 }, NOW, totals),
    ).toMatchObject({ ok: true, value: { status: "needs_review", lookup: "owed" } });
  });
  it("unavailable changes nothing", () => {
    const r = rec("unknown");
    expect(applyLookup(r, { status: "unavailable", reason: "429" }, NOW, totals)).toEqual({
      ok: true,
      value: r,
    });
  });
  it("differs -> needs_review with the provider's identity, from unknown or an owed review, at any time", () => {
    // The answer to the send never reached the record (a swept lease, a lost reply): the lookup
    // reads the document back and finds it is not the one we sent. It must not end issued.
    const differs: LookupOutcome = { ...found, status: "differs", reason: "payment_mismatch" };
    for (const from of [rec("unknown"), owedReview()]) {
      const held = must(applyLookup(from, differs, 0, totals));
      expect(held).toEqual({
        ...base,
        status: "needs_review",
        lookup: "clear",
        issued: { number: "INV-1", providerId: "p1", pdfRef: "pdf" },
        mismatch: null,
        reason: "provider document differs from ours: payment_mismatch",
      });
      // It exists in the provider: never sent again, never cancelled.
      expect(statusAfter(requeue(held))).toBe("refused");
      expect(statusAfter(cancel(held))).toBe("refused");
    }
    const drifted = must(
      applyLookup(
        rec("unknown"),
        { ...differs, totals: { ...totals, grossPence: 1 } },
        NOW,
        totals,
      ),
    );
    expect(drifted).toMatchObject({ mismatch: { field: "grossPence" } });
    expect(applyLookup(rec("unknown"), { ...differs, reason: "" }, NOW, totals)).toMatchObject({
      refusal: { code: "bad_outcome" },
    });
  });
  it("a review that still owes a lookup can be resolved by one", () => {
    expect(statusAfter(applyLookup(owedReview(), found, NOW, totals))).toBe("issued");
  });
  it("refuses when no lookup is owed, and a bad clock", () => {
    for (const s of STATUSES.filter((x) => x !== "unknown")) {
      expect(statusAfter(applyLookup(rec(s), found, NOW, totals))).toBe("refused");
    }
    expect(applyLookup(rec("unknown"), found, Number.NaN, totals)).toMatchObject({
      refusal: { code: "bad_time" },
    });
  });
});

describe("withhold", () => {
  it("sending -> needs_review in one step: nothing sent, nothing owed, never requeued", () => {
    const held = must(withhold(rec("sending"), "t1", "destination_mismatch: x"));
    expect(held).toEqual({
      ...base,
      status: "needs_review",
      lookup: "clear",
      issued: null,
      mismatch: null,
      reason: "destination_mismatch: x",
    });
    // A person decides: the automation never requeues it on its own (only a person's requeue).
    expect(statusAfter(escalate(held, "again"))).toBe("refused");
    expect(parseRecord(held, NOW)).toEqual({ ok: true, value: held });
  });
  it("only the lease's holder may withhold, even after the lease expired, and only with a reason", () => {
    expect(withhold(rec("sending"), "other", "r")).toMatchObject({
      refusal: { code: "lease_mismatch" },
    });
    expect(withhold(rec("sending"), "t1", "")).toMatchObject({ refusal: { code: "bad_outcome" } });
    for (const s of STATUSES.filter((x) => x !== "sending")) {
      expect(statusAfter(withhold(rec(s), "t1", "r"))).toBe("refused");
    }
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
      value: { lookup: "owed", reason: "check", settlesAtMs: SETTLED },
    });
    expect(escalate(rec("failed"), "check")).toMatchObject({
      value: { lookup: "clear", issued: null },
    });
  });
  it("requeue: failed -> pending; needs_review -> pending only with no lookup owed", () => {
    expect(requeue(rec("failed"))).toMatchObject({ ok: true, value: { status: "pending" } });
    expect(requeue(rec("needs_review"))).toMatchObject({ ok: true, value: { status: "pending" } });
    expect(requeue(owedReview())).toMatchObject({ refusal: { code: "lookup_required" } });
    for (const s of STATUSES.filter((x) => x !== "failed" && x !== "needs_review")) {
      expect(statusAfter(requeue(rec(s)))).toBe("refused");
    }
  });
  it("cancel: pending, failed and a settled review; never sending, issued or possibly-sent ones", () => {
    expect(statusAfter(cancel(rec("pending")))).toBe("cancelled");
    expect(statusAfter(cancel(rec("failed")))).toBe("cancelled");
    expect(statusAfter(cancel(rec("needs_review")))).toBe("cancelled");
    expect(cancel(owedReview())).toMatchObject({ refusal: { code: "lookup_required" } });
    expect(cancel(rec("unknown"))).toMatchObject({ refusal: { code: "lookup_required" } });
    for (const s of ["sending", "issued", "cancelled"] as const) {
      expect(statusAfter(cancel(rec(s)))).toBe("refused");
    }
  });
});

describe("never create twice", () => {
  const start = () => must(startSending(newRecord("invoice", "LAX-SHOP-INV-9"), lease, NOW));

  it("timeout inside the lease -> immediate not_found is refused -> no second send", () => {
    // the HTTP client gave up at NOW + 30s, but the provider is still processing the POST
    const unknown = must(
      completeSending(
        start(),
        "t1",
        { status: "unknown", detail: "timeout" },
        NOW + 30_000,
        totals,
      ),
    );
    expect(unknown.status).toBe("unknown");
    const early = applyLookup(unknown, { status: "not_found" }, NOW + 30_001, totals);
    expect(early).toMatchObject({ refusal: { code: "lookup_too_early" } });
    expect(
      statusAfter(startSending(unknown, { token: "t2", expiresAtMs: NOW + 90_000 }, NOW + 30_002)),
    ).toBe("refused");
  });
  it("timeout -> lookup finds it -> issued, with no second send", () => {
    const unknown = must(completeSending(start(), "t1", { status: "unknown" }, NOW + 1, totals));
    expect(startSending(unknown, { token: "t2", expiresAtMs: NOW + 9 }, NOW + 2).ok).toBe(false);
    expect(applyLookup(unknown, found, NOW + 2, totals)).toMatchObject({
      ok: true,
      value: { status: "issued", attempts: 1 },
    });
  });
  it("timeout -> settled not_found -> retry sends again", () => {
    const unknown = must(expireLease(start(), lease.expiresAtMs));
    const pending = must(applyLookup(unknown, { status: "not_found" }, SETTLED, totals));
    expect(
      startSending(pending, { token: "t2", expiresAtMs: SETTLED + 60_000 }, SETTLED + 1),
    ).toMatchObject({ ok: true, value: { status: "sending", attempts: 2 } });
  });

  it("property: random action sequences never send twice without a settled not_found between", () => {
    forAll(400, (rng) => {
      let record: DocumentRecord = newRecord("invoice", "LAX-SHOP-INV-p");
      let now = NOW;
      let token = 0;
      // true while a request may exist in the provider that no settled lookup has ruled out
      let mayExist = false;
      let sends = 0;
      for (let step = 0; step < 40; step++) {
        now += int(rng, 0, 90_000);
        const action = pick(rng, [
          "start",
          "ok",
          "ok_wrong_total",
          "timeout",
          "rejected",
          "expire",
          "not_found",
          "found",
          "ambiguous",
          "unavailable",
          "escalate",
          "requeue",
          "cancel",
        ] as const);
        let next: ReturnType<typeof startSending> | undefined;
        switch (action) {
          case "start": {
            token++;
            next = startSending(
              record,
              { token: `t${token}`, expiresAtMs: now + int(rng, 1, 120_000) },
              now,
            );
            if (next.ok) {
              expect(mayExist).toBe(false);
              sends++;
              mayExist = true;
            }
            break;
          }
          case "ok":
          case "ok_wrong_total":
          case "timeout":
          case "rejected": {
            const outcome: IssueOutcome =
              action === "timeout"
                ? { status: "unknown" }
                : action === "rejected"
                  ? { status: "rejected", reason: "no" }
                  : {
                      ...issuedOutcome,
                      totals: action === "ok" ? totals : { ...totals, netPence: 1 },
                    };
            const tok = record.status === "sending" ? record.lease.token : "x";
            next = completeSending(record, tok, outcome, now, totals);
            if (next.ok && next.value.status === "failed") mayExist = false;
            if (
              next.ok &&
              (next.value.status === "issued" || next.value.status === "needs_review")
            ) {
              mayExist = false; // it exists and we hold its identity: nothing to duplicate
            }
            break;
          }
          case "expire":
            next = expireLease(record, now);
            break;
          case "not_found":
          case "found":
          case "ambiguous":
          case "unavailable": {
            const outcome: LookupOutcome =
              action === "found"
                ? found
                : action === "ambiguous"
                  ? { status: "ambiguous", count: 2 }
                  : action === "unavailable"
                    ? { status: "unavailable", reason: "x" }
                    : { status: "not_found" };
            next = applyLookup(record, outcome, now, totals);
            if (next.ok && action === "not_found") {
              mayExist = false;
              // accepted only once the request can no longer land
              expect(record.status === "unknown" || record.status === "needs_review").toBe(true);
              if (record.status === "unknown" || record.status === "needs_review") {
                if ("settlesAtMs" in record) expect(now).toBeGreaterThanOrEqual(record.settlesAtMs);
              }
            }
            if (next.ok && action === "found") mayExist = false;
            break;
          }
          case "escalate":
            next = escalate(record, "x");
            break;
          case "requeue": {
            next = requeue(record);
            if (next.ok) expect(mayExist).toBe(false);
            break;
          }
          case "cancel":
            next = cancel(record);
            break;
        }
        if (next?.ok) record = next.value;
        // whatever happened, a record that may have a request in flight is never sendable
        if (mayExist && record.status === "pending") {
          throw new Error(`pending while a send may still exist (sends: ${sends})`);
        }
      }
    });
  });
});

describe("parseRecord", () => {
  it("allows the documented clock-skew margin on a lease, and not a millisecond more", () => {
    const at = (expiresAtMs: number) =>
      parseRecord(
        {
          kind: "invoice",
          reference: "LAX-SHOP-INV-1",
          attempts: 1,
          status: "sending",
          lease: { token: "t", expiresAtMs },
        },
        NOW,
      );
    expect(at(NOW + MAX_LEASE_MS + CLOCK_SKEW_MS).ok).toBe(true);
    expect(at(NOW + MAX_LEASE_MS + CLOCK_SKEW_MS + 1).ok).toBe(false);
  });
  it("round-trips every legal record", () => {
    for (const r of [...STATUSES.map(rec), owedReview()]) {
      expect(parseRecord(JSON.parse(JSON.stringify(r)), NOW)).toEqual({ ok: true, value: r });
    }
  });
  it("refuses the illegal states a flat row could hold", () => {
    const flat = { kind: "invoice", reference: "LAX-SHOP-INV-1", attempts: 1 };
    const rows: unknown[] = [
      null,
      "x",
      { ...flat, status: "unknown" }, // no settle time: lookup would not be owed
      { ...flat, status: "unknown", settlesAtMs: Number.NaN },
      { ...flat, status: "unknown", settlesAtMs: Number.POSITIVE_INFINITY },
      { ...flat, status: "sending" },
      { ...flat, status: "sending", lease: { token: "", expiresAtMs: 5 } },
      { ...flat, status: "sending", lease: { token: "t", expiresAtMs: Number.NaN } },
      { ...flat, status: "issued" },
      { ...flat, status: "issued", issued: null },
      { ...flat, status: "failed" },
      { ...flat, status: "needs_review", reason: "r" },
      { ...flat, status: "needs_review", reason: "r", lookup: "owed" },
      { ...flat, status: "needs_review", reason: "r", lookup: "clear", issued: 5 },
      {
        ...flat,
        status: "needs_review",
        reason: "r",
        lookup: "clear",
        issued: null,
        mismatch: { field: "grossPence", differencePence: 1 },
      },
      { ...flat, status: "nonsense" },
      { ...flat, status: "pending", attempts: -1 },
      { ...flat, status: "pending", kind: "refund" },
      { ...flat, status: "pending", reference: "" },
      { ...flat, status: "pending", reference: "anything" },
      { ...flat, status: "pending", reference: "LAX-SHOP-PAY-1" }, // a payment reference on an invoice
      { ...flat, status: "sending", lease: { token: "t", expiresAtMs: 9e15 } },
      {
        ...flat,
        status: "sending",
        lease: { token: "t", expiresAtMs: NOW + MAX_LEASE_MS + CLOCK_SKEW_MS + 1 },
      },
      { ...flat, status: "unknown", settlesAtMs: 9e15 },
      {
        ...flat,
        status: "needs_review",
        reason: "r",
        lookup: "clear",
        issued: doc,
        mismatch: { field: "grossPence", differencePence: Number.NaN },
      },
    ];
    for (const row of rows) {
      expect(parseRecord(row, NOW)).toMatchObject({ ok: false, refusal: { code: "bad_record" } });
    }
  });
  it("a defaulted row (unknown, lookup_required false) cannot become a resend", () => {
    const row = {
      kind: "invoice",
      reference: "LAX-SHOP-INV-1",
      attempts: 1,
      status: "unknown",
      lookupRequired: false,
    };
    expect(parseRecord(row, NOW).ok).toBe(false);
  });
});

describe("malformed provider totals", () => {
  const sending = (): DocumentRecord => rec("sending");
  const unknown = (): DocumentRecord => rec("unknown");
  const bad: unknown[] = [
    undefined,
    null,
    {},
    { netPence: Number.NaN, vatPence: 0, grossPence: 0 },
    { netPence: 1, vatPence: 1.5, grossPence: 2 },
    { netPence: 1, vatPence: 1, grossPence: Number.POSITIVE_INFINITY },
    { netPence: "1", vatPence: 1, grossPence: 2 },
  ];
  it("completeSending refuses them with a typed refusal and never throws", () => {
    for (const totals of bad) {
      const outcome = { ...issuedOutcome, totals } as unknown as IssueOutcome;
      expect(completeSending(sending(), "t1", outcome, NOW, totals as Totals)).toMatchObject({
        ok: false,
        refusal: { code: "bad_outcome" },
      });
      expect(completeSending(sending(), "t1", outcome, NOW, { ...totals } as Totals).ok).toBe(
        false,
      );
    }
  });
  it("applyLookup refuses them and leaves the record able to look again", () => {
    for (const totals of bad) {
      const outcome = { ...found, totals } as unknown as LookupOutcome;
      expect(applyLookup(unknown(), outcome, SETTLED, { ...totals } as Totals)).toMatchObject({
        ok: false,
        refusal: { code: "bad_outcome" },
      });
      const nothing = { ...found } as Record<string, unknown>;
      nothing.totals = undefined;
      expect(
        applyLookup(unknown(), nothing as unknown as LookupOutcome, SETTLED, totals),
      ).toMatchObject({ ok: false, refusal: { code: "bad_outcome" } });
    }
  });
  it("bad expected totals are refused too, and every record that is produced reads back", () => {
    expect(
      applyLookup(unknown(), found, SETTLED, { netPence: Number.NaN } as unknown as Totals).ok,
    ).toBe(false);
    const r = applyLookup(
      unknown(),
      { ...found, totals: { ...totals, grossPence: 12_001 } },
      SETTLED,
      totals,
    );
    expect(r.ok && parseRecord(JSON.parse(JSON.stringify(r.value)), NOW)).toEqual(r);
  });
});

describe("hold", () => {
  const issued: DocumentRecord = {
    kind: "credit_note",
    reference: "LAX-BID-CN-0b6a7c1e-4444-4a5b-8c9d-000000000001",
    attempts: 1,
    status: "issued",
    issued: { number: "CN-1", providerId: "p1", pdfRef: null },
  };

  it("holds an issued document for a person, the provider's document kept", () => {
    const held = hold(issued, "accounting_refund_reversed_after_credit");
    expect(held).toEqual({
      ok: true,
      value: {
        kind: "credit_note",
        reference: issued.reference,
        attempts: 1,
        status: "needs_review",
        lookup: "clear",
        issued: issued.issued,
        mismatch: null,
        reason: "accounting_refund_reversed_after_credit",
      },
    });
    if (!held.ok) return;
    // From there nothing automatic moves it: not requeued, released or cancelled.
    expect(requeue(held.value)).toMatchObject({ ok: false });
    expect(release(held.value)).toMatchObject({ ok: false });
    expect(cancel(held.value)).toMatchObject({ ok: false });
  });

  it("only holds an issued document, and only with a reason", () => {
    expect(hold({ ...issued, status: "pending" } as DocumentRecord, "x")).toMatchObject({
      ok: false,
      refusal: { code: "bad_state" },
    });
    expect(hold(issued, "")).toMatchObject({ ok: false, refusal: { code: "bad_outcome" } });
  });

  it("holds a held document again for a new reason (review N2), the provider's document kept; never one parked or owing a lookup", () => {
    const refused = must(hold(issued, "accounting_credit_note_refund_refused"));
    const again = must(hold(refused, "accounting_refund_reversed_after_credit"));
    expect(again).toEqual({ ...refused, reason: "accounting_refund_reversed_after_credit" });
    expect(hold(again, "accounting_refund_reversed_after_credit")).toMatchObject({
      ok: false,
      refusal: { code: "bad_state" },
    });
    const parked = { ...refused, issued: null } as DocumentRecord;
    expect(hold(parked, "accounting_refund_reversed_after_credit")).toMatchObject({ ok: false });
    const owed = {
      kind: "credit_note",
      reference: issued.reference,
      attempts: 1,
      status: "needs_review",
      lookup: "owed",
      settlesAtMs: 0,
      reason: "unknown_outcome",
    } as DocumentRecord;
    expect(hold(owed, "accounting_refund_reversed_after_credit")).toMatchObject({ ok: false });
  });
});
