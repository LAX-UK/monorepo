import {
  DashboardFetchError,
  buildDashboardSliceFailure,
  buildSellerConnectFailure,
  buildSellerPayoutFailure,
  dashboardSliceFailureMessage,
  describeDashboardSliceFailure,
  describeSessionsOverviewError,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { describe, expect, it } from "vitest";

const SLICES = [
  "bids",
  "portfolio",
  "payments",
  "watchlist",
  "submissions",
  "legalEntities",
] as const;

describe("buildDashboardSliceFailure", () => {
  for (const slice of SLICES) {
    it(`maps 401 for ${slice}`, () => {
      const failure = buildDashboardSliceFailure(slice, 401, null);
      expect(failure.slice).toBe(slice);
      expect(failure.actions.some((a) => a.kind === "signIn")).toBe(true);
    });
  }

  it("delegates legal-entity codes for submissions", () => {
    const failure = buildDashboardSliceFailure("submissions", 403, "not_a_member_of_legal_entity");
    expect(failure.title).toBe("Wrong organisation context");
    expect(failure.actions.some((a) => a.kind === "use_personal_profile")).toBe(true);
  });

  it("delegates legal-entity codes for orgMembers", () => {
    const failure = buildDashboardSliceFailure("orgMembers", 403, "not_a_member_of_legal_entity");
    expect(failure.message).toContain("organisation");
  });
});

describe("describeDashboardSliceFailure", () => {
  it("uses DashboardFetchError detail", () => {
    const err = new DashboardFetchError({ slice: "bids", status: 403, code: null });
    const failure = describeDashboardSliceFailure(err, "bids", "fallback");
    expect(failure.slice).toBe("bids");
    expect(failure.status).toBe(403);
  });

  it("uses embedded failure objects", () => {
    const embedded = buildDashboardSliceFailure("portfolio", 500, null);
    const failure = describeDashboardSliceFailure({ failure: embedded }, "portfolio", "fallback");
    expect(failure.title).toBe(embedded.title);
  });

  it("parses legacy Failed to load messages", () => {
    const failure = describeDashboardSliceFailure(
      new Error("Failed to load portfolio: 403"),
      "portfolio",
      "fallback",
    );
    expect(failure.status).toBe(403);
    expect(failure.slice).toBe("portfolio");
  });

  it("falls back to error message", () => {
    expect(dashboardSliceFailureMessage(new Error("network down"), "watchlist", "fallback")).toBe(
      "network down",
    );
  });
});

describe("describeSettingsActionError", () => {
  it("maps non-empty redirect errors", () => {
    const failure = describeSettingsActionError("Could not update profile");
    expect(failure.message).toBe("Could not update profile");
    expect(failure.title).toBe("Could not save");
  });
});

describe("describeSessionsOverviewError", () => {
  it("maps forbidden code", () => {
    const failure = describeSessionsOverviewError("forbidden");
    expect(failure.message).toContain("permission");
  });
});

describe("seller enum helpers", () => {
  it("maps payout unauthorized", () => {
    const failure = buildSellerPayoutFailure("unauthorized");
    expect(failure.status).toBe(401);
  });

  it("maps connect forbidden", () => {
    const failure = buildSellerConnectFailure("forbidden");
    expect(failure.status).toBe(403);
  });
});
