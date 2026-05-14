import { describe, expect, it } from "vitest";
import { buildDashboardOverviewVm } from "./dashboard-overview.vm";

const emptyErrors = {
  active: null,
  portfolio: null,
  watchlist: null,
  artistFollow: null,
  bids: null,
  submissions: null,
};

describe("buildDashboardOverviewVm", () => {
  it("uses a friendly default when user is missing", () => {
    const vm = buildDashboardOverviewVm({
      user: null,
      activeLots: [],
      portfolio: [],
      watchlist: [],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });
    expect(vm.firstName).toBe("curator");
    expect(vm.kpi.activeBidsCount).toBe(0);
  });

  it("takes first name from user display name", () => {
    const vm = buildDashboardOverviewVm({
      user: { id: "u1", name: "Ada Lovelace", role: "client" },
      activeLots: [],
      portfolio: [],
      watchlist: [],
      artistFollow: [],
      bidRows: [],
      errors: emptyErrors,
      formatMoney: (s) => `£${s}`,
    });
    expect(vm.firstName).toBe("Ada");
  });
});
