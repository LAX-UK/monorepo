import type { UnsoldLotFollowUp } from "@auction/types";
import { describe, expect, it } from "vitest";
import { unsoldFollowUpView } from "./unsold-follow-up-view";

const base: UnsoldLotFollowUp = {
  id: "f1",
  choiceId: "c1",
  lotId: "lot-1",
  lotEndTime: new Date("2026-10-20T18:00:00Z"),
  submissionId: "s1",
  kind: "collect",
  reserve: null,
  status: "open",
  reserveAppliedAt: null,
  completedAt: null,
  completedByUserId: null,
  createdAt: new Date("2026-10-22T10:00:00Z"),
};

describe("unsoldFollowUpView", () => {
  it.each([
    ["collect", "Mark as returned"],
    ["private_sale", "Mark as handled"],
    ["relist", null],
  ] as const)("offers staff the right button for open %s work", (kind, action) => {
    expect(unsoldFollowUpView({ ...base, kind }, "GBP")).toMatchObject({ tone: "info", action });
  });

  it("states the agreed reserve of an open relist, or that it keeps its own", () => {
    expect(
      unsoldFollowUpView({ ...base, kind: "relist", reserve: "4200.00" }, "GBP").detail,
    ).toContain("£4,200");
    expect(unsoldFollowUpView({ ...base, kind: "relist" }, "GBP").detail).toContain(
      "keeps the reserve it ended with",
    );
  });

  it("says who finished the work and when", () => {
    const view = unsoldFollowUpView(
      {
        ...base,
        status: "done",
        completedAt: new Date("2026-10-25T10:00:00Z"),
        completedByName: "Sam Specialist",
      },
      "GBP",
    );
    expect(view).toMatchObject({ tone: "success", action: null, title: "Returned to the seller" });
    expect(view.detail).toContain("Marked done by Sam Specialist");
  });
});
