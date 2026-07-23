import { buildOnboardingIssuesListKpiTiles } from "@/lib/admin/build-onboarding-issues-list-kpi-tiles";
import { buildClientsListKpiTiles } from "@/lib/admin/people/build-clients-list-kpi-tiles";
import { buildInvitationsListKpiTiles } from "@/lib/admin/people/build-invitations-list-kpi-tiles";
import { EMPTY_ADMIN_USER_LIST_SUMMARY } from "@/lib/data/http/admin-users.shared";
import { EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY } from "@/lib/data/http/invitations.shared";
import { describe, expect, it } from "vitest";

describe("buildClientsListKpiTiles", () => {
  it("builds tiles from authoritative summary", () => {
    const tiles = buildClientsListKpiTiles({
      ...EMPTY_ADMIN_USER_LIST_SUMMARY,
      total: 12,
      active: 10,
    });
    expect(tiles[0]?.label).toBe("Total clients");
    expect(tiles[0]?.value).toBe("12");
  });
});

describe("buildInvitationsListKpiTiles", () => {
  it("builds tiles from authoritative summary", () => {
    const tiles = buildInvitationsListKpiTiles({
      ...EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY,
      pending: 3,
    });
    expect(tiles.some((tile) => tile.label === "Pending")).toBe(true);
  });
});

describe("buildOnboardingIssuesListKpiTiles", () => {
  it("builds kyc lens tiles", () => {
    const tiles = buildOnboardingIssuesListKpiTiles(
      {
        tab: "kyc",
        summary: { total: 4, created: 2, requiresInput: 1, processing: 1 },
      },
      "kyc",
    );
    expect(tiles[0]?.label).toBe("Sessions");
    expect(tiles[0]?.value).toBe("4");
  });
});
