import { describe, expect, it } from "vitest";
import type { ChecklistRollupRowView } from "./consignment-checklist-rollup-view";
import { buildSellingNeedsYou } from "./selling-needs-you";

const agreement: ChecklistRollupRowView = {
  id: "agreement",
  state: "action",
  title: "Accept the consignment agreement",
  why: "",
  due: "Needed before the work is catalogued",
  action: { label: "Review", href: "/selling/consignments/s1#agreement" },
  waiting: null,
  concerns: 'For "Figure in a summer landscape"',
};

describe("buildSellingNeedsYou", () => {
  it("is empty when nothing needs the person", () => {
    expect(buildSellingNeedsYou({ checklist: [], attention: [] })).toBeNull();
  });

  it("puts checklist items first and makes the first step the only primary button", () => {
    const vm = buildSellingNeedsYou({
      checklist: [agreement],
      attention: [
        {
          id: "changes:s2",
          title: '"Mirrors" needs changes',
          detail: "Your specialist asked: add a photo of the back",
          status: "Needs changes",
          href: "/selling/consignments/s2",
        },
      ],
    });
    expect(vm?.summary).toBe("Two things to do before your works can go to sale.");
    expect(vm?.items.map((item) => [item.kind, item.action?.label, item.action?.emphasis])).toEqual(
      [
        ["agreement", "Review", "primary"],
        ["changes", "Edit submission", "secondary"],
      ],
    );
    expect(vm?.items[0]?.detail).toBe(
      'For "Figure in a summer landscape" · needed before the work is catalogued',
    );
  });

  it("drops the sale wording when a task comes after the sale", () => {
    const vm = buildSellingNeedsYou({
      checklist: [],
      attention: [
        { id: "unsold", title: "1 lot did not sell", detail: "", status: "", href: "/x" },
      ],
    });
    expect(vm?.summary).toBe("One thing to do.");
    expect(vm?.items[0]?.action).toEqual({
      label: "Choose next step",
      href: "/x",
      emphasis: "primary",
    });
  });

  it("shows a waiting item without a button", () => {
    const vm = buildSellingNeedsYou({
      checklist: [
        { ...agreement, state: "waiting", action: null, waiting: "Waiting for your specialist" },
      ],
      attention: [],
    });
    expect(vm?.items[0]).toMatchObject({ action: null });
    expect(vm?.items[0]?.detail).toContain("waiting for your specialist");
  });
});
