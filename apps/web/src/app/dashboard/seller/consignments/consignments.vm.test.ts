import type { ItemSubmission, Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  CONSIGNMENT_TABS,
  buildConsignmentRows,
  countConsignmentsByTab,
  filterConsignmentRows,
  parseConsignmentTab,
} from "./consignments.vm";

function submission(overrides: Partial<ItemSubmission>): ItemSubmission {
  return {
    id: "s1",
    title: "Untitled study",
    status: "draft",
    convertedLotId: null,
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    ...overrides,
  } as ItemSubmission;
}

function lot(overrides: Partial<Lot>): Lot {
  return {
    id: "l1",
    title: "Harbour at dusk",
    status: "active",
    winnerId: null,
    endTime: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  } as Lot;
}

describe("buildConsignmentRows", () => {
  it("puts submissions and lots in one newest-first list", () => {
    const rows = buildConsignmentRows({
      submissions: [submission({ id: "s1", updatedAt: new Date("2026-10-02T00:00:00Z") })],
      lots: [lot({ id: "l1", endTime: new Date("2026-10-09T00:00:00Z") })],
    });
    expect(rows.map((r) => r.key)).toEqual(["lot:l1", "submission:s1"]);
  });

  it("shows a converted submission once, as its lot", () => {
    const rows = buildConsignmentRows({
      submissions: [submission({ id: "s1", status: "converted", convertedLotId: "l1" })],
      lots: [lot({ id: "l1", status: "draft" })],
    });
    expect(rows.map((r) => r.key)).toEqual(["lot:l1"]);
  });

  it("keeps a converted submission whose lot is not in the list", () => {
    const rows = buildConsignmentRows({
      submissions: [submission({ id: "s1", status: "converted", convertedLotId: "missing" })],
      lots: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.statusLabel).toBe("Preparing catalogue");
  });
});

describe("stages", () => {
  const stageOf = (status: Lot["status"], winnerId: string | null = null) =>
    buildConsignmentRows({ submissions: [], lots: [lot({ status, winnerId })] })[0]?.stage;

  it("maps lot states onto tabs", () => {
    expect(stageOf("scheduled")).toBe("in-sale");
    expect(stageOf("active")).toBe("in-sale");
    expect(stageOf("ended", "buyer-1")).toBe("sold");
    expect(stageOf("ended", null)).toBe("unsold");
    expect(stageOf("cancelled")).toBe("closed");
    expect(stageOf("voided")).toBe("closed");
    expect(stageOf("draft")).toBe("in-review");
  });

  it("maps submission states onto tabs", () => {
    const stage = (status: ItemSubmission["status"]) =>
      buildConsignmentRows({ submissions: [submission({ status })], lots: [] })[0]?.stage;
    expect(stage("draft")).toBe("drafts");
    expect(stage("submitted")).toBe("in-review");
    expect(stage("under_review")).toBe("in-review");
    expect(stage("approved")).toBe("in-review");
    expect(stage("rejected")).toBe("closed");
    expect(stage("withdrawn")).toBe("closed");
  });

  it("sends submissions to their detail page and lots to the public lot page", () => {
    const [lotRow, submissionRow] = buildConsignmentRows({
      submissions: [submission({ id: "s9", updatedAt: new Date("2020-01-01T00:00:00Z") })],
      lots: [lot({ id: "l9" })],
    });
    expect(submissionRow?.href).toBe("/dashboard/submissions/s9");
    expect(lotRow?.href).toContain("l9");
  });
});

describe("filtering and counting", () => {
  const rows = buildConsignmentRows({
    submissions: [submission({ id: "s1", status: "draft" })],
    lots: [lot({ id: "l1", status: "active" }), lot({ id: "l2", status: "ended" })],
  });

  it("filters by tab and treats All as everything", () => {
    expect(filterConsignmentRows(rows, "all")).toHaveLength(3);
    expect(filterConsignmentRows(rows, "in-sale").map((r) => r.key)).toEqual(["lot:l1"]);
    expect(filterConsignmentRows(rows, "sold")).toHaveLength(0);
  });

  it("counts every tab, with All the total", () => {
    expect(countConsignmentsByTab(rows)).toEqual({
      all: 3,
      drafts: 1,
      "in-review": 0,
      "in-sale": 1,
      sold: 0,
      unsold: 1,
      closed: 0,
    });
  });
});

describe("parseConsignmentTab", () => {
  it("accepts every tab", () => {
    for (const tab of CONSIGNMENT_TABS) expect(parseConsignmentTab({ tab })).toBe(tab);
  });

  it("falls back to All for unknown input", () => {
    expect(parseConsignmentTab({ tab: "bogus" })).toBe("all");
    expect(parseConsignmentTab({})).toBe("all");
  });

  it("understands the retired submissions status filter", () => {
    expect(parseConsignmentTab({ status: "draft" })).toBe("drafts");
    expect(parseConsignmentTab({ status: "converted" })).toBe("in-review");
    expect(parseConsignmentTab({ status: "rejected" })).toBe("closed");
    expect(parseConsignmentTab({ status: "all" })).toBe("all");
  });

  it("prefers the new tab over the retired status", () => {
    expect(parseConsignmentTab({ tab: "sold", status: "draft" })).toBe("sold");
  });
});
