import { describe, expect, it } from "vitest";
import {
  effectiveDueOn,
  isOwnRequest,
  planClose,
  planContinue,
  planCreate,
  planExtend,
  planPatch,
} from "./data-request.rules.js";
import {
  NOV_2,
  PERSON,
  STAFF,
  downloadRow,
  manualRow,
  newRequestInput,
} from "./data-request.test-util.js";

function ok<T extends { ok: boolean }>(decision: T): Extract<T, { ok: true }> {
  expect(decision.ok).toBe(true);
  return decision as Extract<T, { ok: true }>;
}

describe("planCreate", () => {
  const ctx = { ...NOV_2, accountExists: true };

  it("starts the clock on the received date when identity is confirmed", () => {
    const plan = ok(planCreate(newRequestInput({ receivedOn: "2026-10-31" }), ctx));
    expect(plan.request).toMatchObject({
      status: "in_progress",
      clockStartedOn: "2026-10-31",
      dueOn: "2026-11-30",
    });
    expect(plan.audit[0]?.event).toBe("data_request.logged");
  });

  it("uses the month's last day when the received date does not exist next month", () => {
    const jan31 = ok(planCreate(newRequestInput({ receivedOn: "2026-01-31" }), ctx));
    expect(jan31.request.dueOn).toBe("2026-02-28");
    const leap = ok(
      planCreate(newRequestInput({ receivedOn: "2028-01-31" }), {
        ...ctx,
        today: "2028-02-10",
      }),
    );
    expect(leap.request.dueOn).toBe("2028-02-29");
  });

  it("waits for ID with no clock and no due date", () => {
    const plan = ok(planCreate(newRequestInput({ identity: "asked_for_proof" }), ctx));
    expect(plan.request).toMatchObject({
      status: "waiting_for_id",
      clockStartedOn: null,
      dueOn: null,
    });
  });

  it("logs a person with no account by their contact", () => {
    const plan = ok(
      planCreate(
        newRequestInput({
          person: { kind: "contact", name: "Lena Fischer", detail: "lena@north.com" },
        }),
        ctx,
      ),
    );
    expect(plan.request).toMatchObject({
      subjectId: null,
      contactName: "Lena Fischer",
      contactDetail: "lena@north.com",
    });
  });

  it("never puts the person's details in the audit row", () => {
    const plan = ok(
      planCreate(
        newRequestInput({
          person: { kind: "contact", name: "Lena Fischer", detail: "lena@north.com" },
          notes: "Called on Monday",
        }),
        ctx,
      ),
    );
    expect(JSON.stringify(plan.audit)).not.toMatch(/Lena|north|Monday/);
  });

  it("refuses a request about the staff member themselves", () => {
    expect(
      planCreate(newRequestInput({ person: { kind: "account", subjectId: STAFF } }), ctx),
    ).toEqual({ ok: false, error: "own_request" });
  });

  it("refuses an account that does not exist and a date in the future", () => {
    expect(planCreate(newRequestInput(), { ...ctx, accountExists: false })).toEqual({
      ok: false,
      error: "account_not_found",
    });
    expect(planCreate(newRequestInput({ receivedOn: "2026-11-03" }), ctx)).toEqual({
      ok: false,
      error: "received_in_future",
    });
  });
});

describe("planPatch", () => {
  const input = { actorSubjectId: STAFF, version: 3 };

  it("starts the clock when proof of ID arrives, using the day it arrived", () => {
    const row = manualRow({ status: "waiting_for_id", clockStartedOn: null, dueOn: null });
    const decision = ok(planPatch(row, { ...input, idReceivedOn: "2026-11-02" }, NOV_2));
    expect(decision.change).toMatchObject({
      status: "in_progress",
      clockStartedOn: "2026-11-02",
      dueOn: "2026-12-02",
    });
    expect(decision.audit[0]?.event).toBe("data_request.clock_started");
  });

  it("counts the month from the day the proof arrived, not the day it was requested", () => {
    const row = manualRow({
      status: "waiting_for_id",
      clockStartedOn: null,
      dueOn: null,
      receivedOn: "2026-10-01",
    });
    const decision = ok(planPatch(row, { ...input, idReceivedOn: "2026-10-31" }, NOV_2));
    expect(decision.change.dueOn).toBe("2026-11-30");
  });

  it("refuses proof of ID dated in the future, before the request, or for a request not waiting", () => {
    const waiting = manualRow({ status: "waiting_for_id", clockStartedOn: null, dueOn: null });
    expect(planPatch(waiting, { ...input, idReceivedOn: "2026-11-03" }, NOV_2)).toEqual({
      ok: false,
      error: "received_in_future",
    });
    expect(planPatch(waiting, { ...input, idReceivedOn: "2026-11-01" }, NOV_2)).toEqual({
      ok: false,
      error: "date_before_received",
    });
    expect(planPatch(manualRow(), { ...input, idReceivedOn: "2026-11-02" }, NOV_2)).toEqual({
      ok: false,
      error: "not_waiting_for_id",
    });
  });

  it("does not let products be ticked off while waiting for ID", () => {
    const waiting = manualRow({ status: "waiting_for_id", clockStartedOn: null, dueOn: null });
    expect(
      planPatch(waiting, { ...input, gathered: { product: "bid", done: true } }, NOV_2),
    ).toEqual({ ok: false, error: "waiting_for_id" });
  });

  it("ticks a product off with who and when, and unticks it", () => {
    const ticked = ok(
      planPatch(manualRow(), { ...input, gathered: { product: "bid", done: true } }, NOV_2),
    );
    expect(ticked.change.productGathered).toEqual({
      bid: { at: NOV_2.now.toISOString(), by: STAFF },
    });
    const unticked = ok(
      planPatch(
        manualRow({ productGathered: { bid: { at: "x", by: STAFF } } }),
        { ...input, gathered: { product: "bid", done: false } },
        NOV_2,
      ),
    );
    expect(unticked.change.productGathered).toEqual({});
    expect(unticked.audit[0]?.event).toBe("data_request.product_ungathered");
  });

  it("refuses a product outside the scope, and narrowing the scope past a gathered product", () => {
    const row = manualRow({
      products: ["account", "bid"],
      productGathered: { bid: { at: "x", by: STAFF } },
    });
    expect(planPatch(row, { ...input, gathered: { product: "shop", done: true } }, NOV_2)).toEqual({
      ok: false,
      error: "product_not_in_scope",
    });
    expect(planPatch(row, { ...input, products: ["account"] }, NOV_2)).toEqual({
      ok: false,
      error: "product_already_gathered",
    });
  });

  it("edits notes without writing them to the audit row", () => {
    const decision = ok(planPatch(manualRow(), { ...input, notes: "Spoke to Lena" }, NOV_2));
    expect(decision.change.notes).toBe("Spoke to Lena");
    expect(JSON.stringify(decision.audit)).not.toContain("Lena");
  });

  it("edits the contact only for a person with no account", () => {
    expect(planPatch(manualRow(), { ...input, contactName: "L. Fischer" }, NOV_2)).toEqual({
      ok: false,
      error: "contact_not_editable",
    });
    const noAccount = manualRow({ subjectId: null, contactName: "Lena", contactDetail: "x@y.z" });
    const decision = ok(planPatch(noAccount, { ...input, contactName: "Lena F." }, NOV_2));
    expect(decision.change.contactName).toBe("Lena F.");
    expect(JSON.stringify(decision.audit)).not.toContain("Lena");
  });

  it("answers 409 for a stale version and refuses a closed request", () => {
    expect(planPatch(manualRow({ version: 4 }), { ...input, notes: "x" }, NOV_2)).toEqual({
      ok: false,
      error: "stale_version",
    });
    expect(
      planPatch(manualRow({ status: "closed", outcome: "sent" }), { ...input, notes: "x" }, NOV_2),
    ).toEqual({ ok: false, error: "already_closed" });
  });
});

describe("planExtend", () => {
  const input = {
    actorSubjectId: STAFF,
    version: 3,
    months: 2 as const,
    reason: "complex" as const,
    note: "Needs the specialist's archive",
    personToldOn: "2026-11-20",
    personToldVia: "email" as const,
  };
  const ctx = { today: "2026-11-25", now: new Date("2026-11-25T09:00:00.000Z") };

  it("adds the months to the original due date and records how the person was told", () => {
    const decision = ok(planExtend(manualRow(), input, ctx));
    expect(decision.change).toMatchObject({
      extendedDueOn: "2027-02-02",
      extensionReason: "complex",
      personToldOn: "2026-11-20",
      personToldVia: "email",
    });
    expect(effectiveDueOn({ dueOn: "2026-12-02", extendedDueOn: "2027-02-02" })).toBe("2027-02-02");
  });

  it("clamps to the last day of a short month, including a leap year", () => {
    const dec31 = manualRow({ dueOn: "2026-12-31" });
    expect(ok(planExtend(dec31, input, ctx)).change.extendedDueOn).toBe("2027-02-28");
    const leap = manualRow({ dueOn: "2027-12-31" });
    expect(
      ok(
        planExtend(leap, { ...input, personToldOn: "2027-12-01" }, { ...ctx, today: "2027-12-10" }),
      ).change.extendedDueOn,
    ).toBe("2028-02-29");
    expect(ok(planExtend(manualRow(), { ...input, months: 1 }, ctx)).change.extendedDueOn).toBe(
      "2027-01-02",
    );
  });

  it("allows the extension on the due date itself but not the day after", () => {
    const row = manualRow();
    expect(
      planExtend(row, { ...input, personToldOn: "2026-12-02" }, { ...ctx, today: "2026-12-02" }).ok,
    ).toBe(true);
    expect(planExtend(row, input, { ...ctx, today: "2026-12-03" })).toEqual({
      ok: false,
      error: "extension_after_due_date",
    });
  });

  it("is allowed once only", () => {
    const extended = manualRow({ extendedDueOn: "2027-01-02" });
    expect(planExtend(extended, input, ctx)).toEqual({ ok: false, error: "already_extended" });
  });

  it("needs the person told on or before the original due date, and not in the future", () => {
    expect(
      planExtend(
        manualRow(),
        { ...input, personToldOn: "2026-12-03" },
        { ...ctx, today: "2026-12-02" },
      ),
    ).toEqual({
      ok: false,
      error: "person_told_after_due_date",
    });
    expect(planExtend(manualRow(), { ...input, personToldOn: "2026-11-26" }, ctx)).toEqual({
      ok: false,
      error: "told_in_future",
    });
  });

  it("has nothing to extend while waiting for ID, and refuses a closed request", () => {
    expect(
      planExtend(
        manualRow({ status: "waiting_for_id", clockStartedOn: null, dueOn: null }),
        input,
        ctx,
      ),
    ).toEqual({ ok: false, error: "waiting_for_id" });
    expect(planExtend(manualRow({ status: "closed", outcome: "sent" }), input, ctx)).toEqual({
      ok: false,
      error: "already_closed",
    });
  });

  it("keeps the note out of the audit row", () => {
    const decision = ok(planExtend(manualRow(), input, ctx));
    expect(JSON.stringify(decision.audit)).not.toContain("archive");
  });
});

describe("planClose", () => {
  const input = { actorSubjectId: STAFF, version: 3 };

  it("records the outcome, the day and who closed it, on time", () => {
    const decision = ok(planClose(manualRow(), { ...input, outcome: "sent" }, NOV_2));
    expect(decision.change).toMatchObject({
      status: "closed",
      outcome: "sent",
      closedOn: "2026-11-02",
      closedBy: STAFF,
    });
    expect(decision.audit[0]?.detail).toMatchObject({ daysLate: 0, onTime: true });
  });

  it("records how many days late against the extended date when there is one", () => {
    const late = { today: "2026-12-05", now: new Date("2026-12-05T09:00:00.000Z") };
    expect(
      ok(planClose(manualRow(), { ...input, outcome: "sent" }, late)).audit[0]?.detail,
    ).toMatchObject({
      daysLate: 3,
      onTime: false,
    });
    const extended = manualRow({ extendedDueOn: "2027-01-02" });
    expect(
      ok(planClose(extended, { ...input, outcome: "sent" }, late)).audit[0]?.detail,
    ).toMatchObject({
      daysLate: 0,
      onTime: true,
    });
  });

  it("needs the exemption for a partial copy", () => {
    expect(planClose(manualRow(), { ...input, outcome: "sent_partial" }, NOV_2)).toEqual({
      ok: false,
      error: "exemption_required",
    });
    expect(
      ok(
        planClose(
          manualRow(),
          { ...input, outcome: "sent_partial", note: "Legal privilege" },
          NOV_2,
        ),
      ).change.outcomeNote,
    ).toBe("Legal privilege");
  });

  it("needs a reason and the right to complain for a refusal", () => {
    const refused = { ...input, outcome: "refused" as const };
    expect(planClose(manualRow(), refused, NOV_2)).toEqual({
      ok: false,
      error: "refusal_reason_required",
    });
    expect(planClose(manualRow(), { ...refused, note: "Excessive" }, NOV_2)).toEqual({
      ok: false,
      error: "complaint_right_required",
    });
    const decision = ok(
      planClose(manualRow(), { ...refused, note: "Excessive", complaintRightTold: true }, NOV_2),
    );
    expect(decision.change).toMatchObject({ outcome: "refused", complaintRightTold: true });
  });

  it("closes a request that never started only as withdrawn or refused", () => {
    const waiting = manualRow({ status: "waiting_for_id", clockStartedOn: null, dueOn: null });
    expect(planClose(waiting, { ...input, outcome: "sent" }, NOV_2)).toEqual({
      ok: false,
      error: "waiting_for_id",
    });
    const withdrawn = ok(planClose(waiting, { ...input, outcome: "withdrawn" }, NOV_2));
    expect(withdrawn.audit[0]?.detail).toMatchObject({ daysLate: null });
  });

  it("is closed once", () => {
    expect(
      planClose(
        manualRow({ status: "closed", outcome: "sent" }),
        { ...input, outcome: "sent" },
        NOV_2,
      ),
    ).toEqual({ ok: false, error: "already_closed" });
  });
});

describe("planContinue", () => {
  it("keeps the original received and due dates, in London time", () => {
    const decision = ok(planContinue(downloadRow(), false, STAFF, NOV_2));
    expect(decision.plan.request).toMatchObject({
      subjectId: PERSON,
      receivedOn: "2026-10-20",
      clockStartedOn: "2026-10-20",
      dueOn: "2026-11-20",
      status: "in_progress",
      linkedExportId: downloadRow().id,
      products: ["account", "bid", "shop"],
    });
    expect(decision.plan.request.productGathered).toEqual({
      account: { at: NOV_2.now.toISOString(), by: "system" },
    });
    expect(decision.plan.exportAudit.event).toBe("data_export.continued_manually");
  });

  it("works for a failed download too, and only for delayed or failed ones", () => {
    expect(planContinue(downloadRow({ status: "failed" }), false, STAFF, NOV_2).ok).toBe(true);
    for (const status of ["requested", "collecting", "ready", "expired", "deleted"] as const) {
      expect(planContinue(downloadRow({ status }), false, STAFF, NOV_2)).toEqual({
        ok: false,
        error: "continue_not_allowed",
      });
    }
  });

  it("continues a download once", () => {
    expect(planContinue(downloadRow(), true, STAFF, NOV_2)).toEqual({
      ok: false,
      error: "already_continued",
    });
  });

  it("refuses the person's own request", () => {
    expect(planContinue(downloadRow(), false, PERSON, NOV_2)).toEqual({
      ok: false,
      error: "own_request",
    });
  });
});

describe("the actor is never the subject", () => {
  it("is refused on every change", () => {
    const own = manualRow({ subjectId: STAFF });
    const input = { actorSubjectId: STAFF, version: 3 };
    expect(isOwnRequest(own.subjectId, STAFF)).toBe(true);
    expect(isOwnRequest(null, STAFF)).toBe(false);
    expect(planPatch(own, { ...input, notes: "x" }, NOV_2)).toEqual({
      ok: false,
      error: "own_request",
    });
    expect(
      planExtend(
        own,
        {
          ...input,
          months: 1,
          reason: "complex",
          note: "x",
          personToldOn: "2026-11-02",
          personToldVia: "email",
        },
        NOV_2,
      ),
    ).toEqual({ ok: false, error: "own_request" });
    expect(planClose(own, { ...input, outcome: "sent" }, NOV_2)).toEqual({
      ok: false,
      error: "own_request",
    });
  });

  it("is checked before the version, so a stale own request is still refused as own", () => {
    expect(
      planPatch(
        manualRow({ subjectId: STAFF, version: 9 }),
        { actorSubjectId: STAFF, version: 3, notes: "x" },
        NOV_2,
      ),
    ).toEqual({ ok: false, error: "own_request" });
  });
});
