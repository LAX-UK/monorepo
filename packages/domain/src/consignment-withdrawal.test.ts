import type { ItemSubmissionStatus, LegalEntityMemberRole, LotStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  canActOnConsignmentWithdrawal,
  consignmentWithdrawalPath,
} from "./consignment-withdrawal.js";

describe("consignmentWithdrawalPath", () => {
  it.each([
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "approved",
  ] as ItemSubmissionStatus[])("lets the seller withdraw a %s consignment themselves", (status) => {
    expect(
      consignmentWithdrawalPath({ submissionStatus: status, lot: null, pendingRequest: false }),
    ).toBe("withdraw_now");
  });

  it.each(["draft", "scheduled", "active"] as LotStatus[])(
    "asks staff to withdraw a catalogued %s lot",
    (status) => {
      expect(
        consignmentWithdrawalPath({
          submissionStatus: "converted",
          lot: { status },
          pendingRequest: false,
        }),
      ).toBe("request");
    },
  );

  it("shows a waiting request instead of asking twice", () => {
    expect(
      consignmentWithdrawalPath({
        submissionStatus: "converted",
        lot: { status: "scheduled" },
        pendingRequest: true,
      }),
    ).toBe("requested");
  });

  it.each([
    ["converted", "ended"],
    ["converted", "cancelled"],
    ["rejected", null],
    ["withdrawn", null],
  ] as [ItemSubmissionStatus, LotStatus | null][])(
    "has nothing to withdraw for a %s consignment (lot %s)",
    (submissionStatus, lotStatus) => {
      expect(
        consignmentWithdrawalPath({
          submissionStatus,
          lot: lotStatus ? { status: lotStatus } : null,
          pendingRequest: false,
        }),
      ).toBe("unavailable");
    },
  );
});

describe("canActOnConsignmentWithdrawal", () => {
  it("lets a person act on their own consignments", () => {
    expect(canActOnConsignmentWithdrawal("withdraw_now", null)).toBe(true);
    expect(canActOnConsignmentWithdrawal("request", null)).toBe(true);
  });

  it.each([
    ["owner", true, true],
    ["admin", true, true],
    ["consignor", true, false],
    ["finance", false, false],
    ["viewer", false, false],
    ["buyer_agent", false, false],
  ] as [LegalEntityMemberRole, boolean, boolean][])(
    "an organisation %s: withdraw before cataloguing %s, ask after %s",
    (role, before, after) => {
      expect(canActOnConsignmentWithdrawal("withdraw_now", { role })).toBe(before);
      expect(canActOnConsignmentWithdrawal("request", { role })).toBe(after);
    },
  );

  it("refuses an impersonating admin and anything unavailable", () => {
    expect(
      canActOnConsignmentWithdrawal("withdraw_now", { role: "owner", isImpersonation: true }),
    ).toBe(false);
    expect(canActOnConsignmentWithdrawal("unavailable", null)).toBe(false);
  });
});
