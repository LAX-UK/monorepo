import { describe, expect, it } from "vitest";
import { consignmentsListView } from "./consignments-list-view";
import type { ConsignmentTab } from "./consignments.vm";

const PATH = "/selling/consignments";
const NONE: Record<ConsignmentTab, number> = {
  all: 0,
  drafts: 0,
  "in-review": 0,
  "in-sale": 0,
  sold: 0,
  unsold: 0,
  closed: 0,
};

function view(overrides: Partial<Parameters<typeof consignmentsListView>[0]> = {}) {
  return consignmentsListView({
    counts: NONE,
    tab: "all",
    reviewStage: null,
    shown: 0,
    canSell: true,
    path: PATH,
    ...overrides,
  });
}

describe("consignmentsListView", () => {
  describe("the header action, one primary per screen", () => {
    it.each([
      // works, can sell → header action, empty-state action
      [0, true, false, true],
      [0, false, false, false],
      [3, true, true, undefined],
      [3, false, false, undefined],
    ] as const)(
      "with %i works and canSell %s: header %s, empty state %s",
      (works, canSell, header, empty) => {
        const v = view({
          counts: { ...NONE, all: works, drafts: works },
          shown: works,
          canSell,
        });
        expect(v.headerAction).toBe(header);
        expect(v.state === "empty" ? v.emptyAction : undefined).toBe(empty);
      },
    );
  });

  it("shows no filter chips before there are works", () => {
    expect(view().chips).toBeNull();
  });

  it("shows no chips while only one stage holds works: they could not narrow the list", () => {
    expect(view({ counts: { ...NONE, all: 2, "in-review": 2 }, shown: 2 }).chips).toBeNull();
  });

  it("hides chips with nothing in them, except All", () => {
    const v = view({ counts: { ...NONE, all: 3, drafts: 1, sold: 2 }, shown: 3 });
    expect(v.chips?.map((chip) => [chip.id, chip.count, chip.href])).toEqual([
      ["all", 3, PATH],
      ["drafts", 1, `${PATH}?tab=drafts`],
      ["sold", 2, `${PATH}?tab=sold`],
    ]);
    expect(v.chips?.find((chip) => chip.active)?.id).toBe("all");
  });

  it("keeps the chips on a filter the person opened, even with one stage filled", () => {
    const v = view({ counts: { ...NONE, all: 2, "in-review": 2 }, tab: "in-review", shown: 2 });
    expect(v.chips?.map((chip) => chip.id)).toEqual(["all", "in-review"]);
  });

  it("keeps the chip the person is on, even when it is empty, and offers to clear it", () => {
    const v = view({ counts: { ...NONE, all: 2, drafts: 2 }, tab: "unsold", shown: 0 });
    expect(v.state).toBe("no-results");
    expect(v.chips?.map((chip) => chip.id)).toEqual(["all", "drafts", "unsold"]);
    expect(v.chips?.find((chip) => chip.active)?.id).toBe("unsold");
    if (v.state !== "no-results") throw new Error("expected no results");
    expect(v.noResults.title).toBe("No consignments match “Unsold”");
  });

  it("names a review stage in the no-results title", () => {
    const v = view({
      counts: { ...NONE, all: 1, drafts: 1 },
      tab: "in-review",
      reviewStage: "needs_changes",
      shown: 0,
    });
    if (v.state !== "no-results") throw new Error("expected no results");
    expect(v.noResults.title).toBe("No consignments match “Needs changes”");
  });
});
