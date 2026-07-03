import { DrizzleAdminFinanceIssueSnapshotReader } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { AdminFinanceIssueSnapshotQueryService } from "./admin-finance-issue-snapshot-query.service.js";

describe("AdminFinanceIssueSnapshotQueryService.getFinanceIssueSnapshot", () => {
  it("maps aggregate counts into snapshot fields", async () => {
    const counts = [1, 2, 3, 4, 5, 6, 7, 8];
    let call = 0;
    const select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ n: counts[call++] }]),
    }));
    const reader = new DrizzleAdminFinanceIssueSnapshotReader({ select } as never);
    const svc = new AdminFinanceIssueSnapshotQueryService(reader);

    await expect(svc.getFinanceIssueSnapshot()).resolves.toEqual({
      failedPayoutCount: 1,
      legalEntitiesWithStripeConnectRequirementsCount: 2,
      staleBlockedScheduledPayoutCount: 3,
      entitiesPendingReviewCount: 4,
      artistsPendingApprovalCount: 5,
      staleKycSessionsCount: 6,
      documentsAwaitingReviewCount: 7,
      staleLeadOrganisationsCount: 8,
    });
    expect(select).toHaveBeenCalledTimes(8);
  });
});

describe("AdminFinanceIssueSnapshotQueryService.listStripeConnectRequirementEntities", () => {
  it("returns rows from legal entity query", async () => {
    const rows = [
      {
        id: "le-1",
        displayName: "Gallery",
        status: "active",
        stripeConnectRequirementsCurrentlyDue: ["external_account"],
      },
    ];
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    });
    const reader = new DrizzleAdminFinanceIssueSnapshotReader({ select } as never);
    const svc = new AdminFinanceIssueSnapshotQueryService(reader);

    await expect(svc.listStripeConnectRequirementEntities()).resolves.toEqual(rows);
  });
});
