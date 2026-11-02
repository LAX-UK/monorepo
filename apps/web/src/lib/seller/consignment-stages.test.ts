import {
  CONSIGNMENT_STAGE_LABEL as HOME_LABEL,
  consignmentStageHref,
} from "@/lib/organisation-home/consignment-stage-links";
import { describe, expect, it } from "vitest";
import {
  CONSIGNMENT_STAGES,
  CONSIGNMENT_STATUS,
  type ConsignmentStatus,
  NEEDS_CHANGES_LABEL,
} from "./consignment-status";
import {
  CONSIGNMENT_VIEWS,
  CONSIGNMENT_VIEW_LABEL,
  parseConsignmentsListQuery,
} from "./consignments-list";

describe("the one stage list", () => {
  it("names the stages in order", () => {
    expect(CONSIGNMENT_STAGES.map((stage) => stage.label)).toEqual([
      "Draft",
      "In review",
      "Accepted",
      "In a sale",
      "Sold",
      "Did not sell",
    ]);
  });

  it("gives the list a tab per stage, after All and Needs you, with the same words", () => {
    expect(CONSIGNMENT_VIEWS).toEqual([
      "all",
      "needs-you",
      "drafts",
      "in-review",
      "accepted",
      "in-sale",
      "sold",
      "unsold",
    ]);
    expect(CONSIGNMENT_VIEWS.map((view) => CONSIGNMENT_VIEW_LABEL[view])).toEqual([
      "All",
      "Needs you",
      ...CONSIGNMENT_STAGES.map((stage) => stage.label),
    ]);
  });

  it("badges every status with its stage's name, apart from Needs changes on In review", () => {
    const stageLabel = new Map<string, string>(CONSIGNMENT_STAGES.map((s) => [s.id, s.label]));
    const exceptions: Partial<Record<ConsignmentStatus, string>> = {
      needs_changes: NEEDS_CHANGES_LABEL,
      not_accepted: "Not accepted",
      withdrawn: "Withdrawn",
      cancelled: "Withdrawn from sale",
    };
    for (const [status, view] of Object.entries(CONSIGNMENT_STATUS)) {
      const expected = exceptions[status as ConsignmentStatus] ?? stageLabel.get(view.stage);
      expect(view.label, status).toBe(expected);
    }
    expect(CONSIGNMENT_STATUS.needs_changes.stage).toBe("in-review");
  });

  it("keeps Home's stage names and links on the same words", () => {
    expect(HOME_LABEL).toEqual({
      under_review: "In review",
      needs_changes: "Needs changes",
      accepted: "Accepted",
      in_sale: "In a sale",
      sold: "Sold",
      unsold: "Did not sell",
    });
    expect(consignmentStageHref("accepted")).toBe("/selling/consignments?tab=accepted");
    expect(parseConsignmentsListQuery({ tab: "in-review", stage: "needs_changes" }).stage).toBe(
      "needs_changes",
    );
  });

  it("uses no em dashes in any stage word", () => {
    for (const { label } of Object.values(CONSIGNMENT_STATUS)) expect(label).not.toContain("—");
  });
});
