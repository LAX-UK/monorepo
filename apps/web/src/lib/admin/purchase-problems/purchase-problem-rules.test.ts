import { describe, expect, it } from "vitest";
import { purchaseProblemLinks } from "./purchase-problem-access";
import { purchaseProblemRecordActions } from "./purchase-problem-actions";
import { isStalePurchaseProblem, purchaseProblemErrorMessage } from "./purchase-problem-errors";
import { validateNote, validateResolution } from "./purchase-problem-forms";
import { purchaseProblemTimeline } from "./purchase-problem-timeline";
import { inProgressProblem, openProblem, resolvedProblem } from "./purchase-problem.fixture";

describe("purchaseProblemRecordActions", () => {
  it("offers to take on or resolve an open report", () => {
    expect(purchaseProblemRecordActions(openProblem)).toEqual({
      canStart: true,
      canResolve: true,
      canAssign: true,
      canNote: true,
    });
  });

  it("offers only resolving once it is in progress", () => {
    expect(purchaseProblemRecordActions(inProgressProblem)).toMatchObject({
      canStart: false,
      canResolve: true,
      canAssign: true,
    });
  });

  it("offers no move and no hand over once resolved, but still a note", () => {
    expect(purchaseProblemRecordActions(resolvedProblem)).toEqual({
      canStart: false,
      canResolve: false,
      canAssign: false,
      canNote: true,
    });
  });
});

describe("forms", () => {
  it("needs a note to add one, and a resolution to say what was done", () => {
    expect(validateNote("  ")).toMatch(/Write the note/);
    expect(validateNote("Called the buyer.")).toBeNull();
    expect(validateResolution("")).toMatch(/what was done/);
    expect(validateResolution("Refund issued.")).toBeNull();
    expect(validateNote("x".repeat(2001))).toMatch(/under 2000/);
  });
});

describe("errors", () => {
  it("gives the API's own refusal a sentence, and a plain one for anything else", () => {
    expect(purchaseProblemErrorMessage("resolution_note_required", 422)).toMatch(/what was done/);
    expect(purchaseProblemErrorMessage(undefined, 403)).toMatch(/permission/);
    expect(purchaseProblemErrorMessage(undefined, undefined)).toMatch(/didn't answer/);
    expect(isStalePurchaseProblem("stale_version")).toBe(true);
    expect(isStalePurchaseProblem("unchanged")).toBe(false);
  });
});

describe("purchaseProblemTimeline", () => {
  const nameOf = (id: string | null) => (id === "u-sofia" ? "Sofia Okafor" : undefined);

  it("starts with the buyer's report and lists the newest first, outcome on top", () => {
    const events = purchaseProblemTimeline(resolvedProblem, nameOf);
    expect(events.map((event) => event.id)).toEqual(["resolved", "note-n2", "note-n1", "reported"]);
    expect(events[0]).toMatchObject({ title: "Resolved", actor: "Sofia Okafor", tone: "success" });
  });

  it("holds only the report for a new one", () => {
    expect(purchaseProblemTimeline(openProblem, nameOf).map((event) => event.title)).toEqual([
      "Reported by the buyer",
    ]);
  });
});

describe("purchaseProblemLinks", () => {
  it("offers each link only to the people whose role opens that page", () => {
    expect(purchaseProblemLinks({ role: "staff", staffRoles: ["client_services"] })).toEqual({
      payment: false,
      lot: false,
      fulfilment: false,
    });
    expect(purchaseProblemLinks({ role: "staff", staffRoles: ["administrator"] })).toEqual({
      payment: true,
      lot: true,
      fulfilment: true,
    });
  });
});
