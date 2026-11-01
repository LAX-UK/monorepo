import { itemSubmissionStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type ConsignmentChecklistFacts,
  computeConsignmentChecklist,
  rollupConsignmentChecklists,
} from "./consignment-checklist.js";

const base: ConsignmentChecklistFacts = {
  submissionStatus: "under_review",
  lotStatus: null,
  accountKind: "personal",
  identity: "required",
  agreement: { proposed: false, accepted: false },
  payoutsReady: false,
  viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
  saleStartsAt: null,
};

function stateOf(facts: Partial<ConsignmentChecklistFacts>, id: string) {
  return computeConsignmentChecklist({ ...base, ...facts }).items.find((i) => i.id === id);
}

describe("computeConsignmentChecklist", () => {
  it("applies once submitted and while the work is on its way to sale", () => {
    for (const status of itemSubmissionStatuses) {
      const applies = computeConsignmentChecklist({ ...base, submissionStatus: status }).applies;
      expect(applies).toBe(
        ["submitted", "under_review", "changes_requested", "approved", "converted"].includes(
          status,
        ),
      );
    }
  });

  it("applies only until the lot's sale is live", () => {
    const applies = (lotStatus: ConsignmentChecklistFacts["lotStatus"]) =>
      computeConsignmentChecklist({ ...base, submissionStatus: "converted", lotStatus }).applies;
    expect(applies(null)).toBe(true);
    expect(applies("draft")).toBe(true);
    expect(applies("scheduled")).toBe(true);
    for (const past of ["active", "ended", "cancelled", "voided"] as const) {
      expect(applies(past)).toBe(false);
    }
  });

  it("orders identity, agreement, payouts with their deadlines", () => {
    const list = computeConsignmentChecklist({
      ...base,
      saleStartsAt: new Date("2026-11-04"),
    });
    expect(list.items.map((i) => [i.id, i.deadline.kind])).toEqual([
      ["identity", "before_specialist_accepts"],
      ["agreement", "before_cataloguing"],
      ["payouts", "before_sale_live"],
    ]);
    expect(list.items[2]?.deadline).toEqual({
      kind: "before_sale_live",
      date: new Date("2026-11-04"),
    });
  });

  describe.each([
    ["verified", "done", null],
    ["checking", "waiting", "lax_identity_check"],
    ["required", "action", null],
  ] as const)("identity %s", (identity, state, waitingOn) => {
    it(`is ${state}`, () => {
      expect(stateOf({ identity }, "identity")).toMatchObject({ state, waitingOn });
    });
  });

  describe("agreement", () => {
    const cases = [
      // proposed, accepted, canAccept → state, waitingOn
      [false, false, true, "not_yet", null],
      [false, false, false, "not_yet", null],
      [true, false, true, "action", null],
      [true, false, false, "waiting", "organisation_acceptor"],
      [true, true, true, "done", null],
      [true, true, false, "done", null],
    ] as const;
    it.each(cases)(
      "proposed=%s accepted=%s canAccept=%s is %s",
      (proposed, accepted, canAcceptAgreement, state, waitingOn) => {
        expect(
          stateOf(
            {
              agreement: { proposed, accepted },
              viewer: { canAcceptAgreement, canSetUpPayouts: true },
            },
            "agreement",
          ),
        ).toMatchObject({ state, waitingOn });
      },
    );
  });

  describe("payouts", () => {
    const cases = [
      [true, true, "done", null],
      [true, false, "done", null],
      [false, true, "action", null],
      [false, false, "waiting", "organisation_payouts"],
    ] as const;
    it.each(cases)(
      "ready=%s canSetUp=%s is %s",
      (payoutsReady, canSetUpPayouts, state, waitingOn) => {
        expect(
          stateOf(
            { payoutsReady, viewer: { canAcceptAgreement: true, canSetUpPayouts } },
            "payouts",
          ),
        ).toMatchObject({ state, waitingOn });
      },
    );
  });

  it("counts done items and reports completion", () => {
    const none = computeConsignmentChecklist(base);
    expect([none.doneCount, none.totalCount, none.complete]).toEqual([0, 3, false]);
    const part = computeConsignmentChecklist({ ...base, identity: "verified" });
    expect([part.doneCount, part.complete]).toEqual([1, false]);
    const all = computeConsignmentChecklist({
      ...base,
      identity: "verified",
      agreement: { proposed: true, accepted: true },
      payoutsReady: true,
    });
    expect([all.doneCount, all.complete]).toEqual([3, true]);
  });
});

describe("rollupConsignmentChecklists", () => {
  it("groups open items across consignments, actions first, skipping ones that do not apply", () => {
    const needsAll = computeConsignmentChecklist({
      ...base,
      agreement: { proposed: true, accepted: false },
    });
    const waitingPayouts = computeConsignmentChecklist({
      ...base,
      identity: "verified",
      agreement: { proposed: true, accepted: true },
      viewer: { canAcceptAgreement: false, canSetUpPayouts: false },
    });
    const draft = computeConsignmentChecklist({ ...base, submissionStatus: "draft" });
    const rollup = rollupConsignmentChecklists([
      { id: "a", title: "Blue", checklist: needsAll },
      { id: "b", title: "Red", checklist: waitingPayouts },
      { id: "c", title: "Draft", checklist: draft },
    ]);
    expect(rollup.map((r) => [r.id, r.state, r.consignments.map((c) => c.id)])).toEqual([
      ["identity", "action", ["a"]],
      ["agreement", "action", ["a"]],
      ["payouts", "action", ["a"]],
      ["payouts", "waiting", ["b"]],
    ]);
  });

  it("is empty when everything is done", () => {
    const done = computeConsignmentChecklist({
      ...base,
      identity: "verified",
      agreement: { proposed: true, accepted: true },
      payoutsReady: true,
    });
    expect(rollupConsignmentChecklists([{ id: "a", title: "A", checklist: done }])).toEqual([]);
  });
});
