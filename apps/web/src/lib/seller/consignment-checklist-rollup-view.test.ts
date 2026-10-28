import type { ConsignmentChecklistRollupItem } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { checklistRollupRows } from "./consignment-checklist-rollup-view";

const ctx = { accountKind: "personal" as const, organisationName: null };

describe("checklistRollupRows", () => {
  it("names the work an item is for and links the agreement to its consignment", () => {
    const rollup: ConsignmentChecklistRollupItem[] = [
      {
        id: "agreement",
        state: "action",
        waitingOn: null,
        consignments: [{ id: "a", title: "Blue" }],
      },
    ];
    expect(checklistRollupRows(rollup, ctx)[0]).toMatchObject({
      title: "Accept the consignment agreement",
      concerns: 'For "Blue"',
      action: { label: "Review", href: "/selling/consignments/a#agreement" },
    });
  });

  it("folds many works into a short line and opens the list", () => {
    const rollup: ConsignmentChecklistRollupItem[] = [
      {
        id: "agreement",
        state: "action",
        waitingOn: null,
        consignments: [
          { id: "a", title: "Blue" },
          { id: "b", title: "Red" },
          { id: "c", title: "Green" },
        ],
      },
    ];
    const [row] = checklistRollupRows(rollup, ctx);
    expect(row?.concerns).toBe('For "Blue" and 2 more');
    expect(row?.action?.href).toBe("/selling/consignments");
  });

  it("says what an organisation consignor is waiting on", () => {
    const rollup: ConsignmentChecklistRollupItem[] = [
      {
        id: "payouts",
        state: "waiting",
        waitingOn: "organisation_payouts",
        consignments: [
          { id: "a", title: "Blue" },
          { id: "b", title: "Red" },
        ],
      },
    ];
    const [row] = checklistRollupRows(rollup, {
      accountKind: "organisation",
      organisationName: "Northbank Gallery",
    });
    expect(row).toMatchObject({
      concerns: 'For "Blue" and "Red"',
      waiting: "Waiting for Northbank Gallery's payout setup",
      action: null,
    });
  });
});
