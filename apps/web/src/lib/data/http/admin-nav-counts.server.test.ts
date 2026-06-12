import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});

const authedServerFetch = vi.fn();
vi.mock("./authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => authedServerFetch(...args),
}));

import { getAdminNavCounts, getFinanceAdminNavCounts } from "./admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "./admin-nav-counts.types";

describe("getAdminNavCounts", () => {
  beforeEach(() => {
    authedServerFetch.mockReset();
  });

  it("returns counts from /admin/nav-counts", async () => {
    authedServerFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { ...EMPTY_ADMIN_NAV_COUNTS, submissionsPending: 3, artistsPending: 2 },
      }),
    });
    const counts = await getAdminNavCounts();
    expect(counts.submissionsPending).toBe(3);
    expect(counts.artistsPending).toBe(2);
    expect(authedServerFetch).toHaveBeenCalledWith("/admin/nav-counts");
  });

  it("falls back to empty when response is not ok", async () => {
    authedServerFetch.mockResolvedValue({ ok: false });
    const counts = await getAdminNavCounts();
    expect(counts).toEqual(EMPTY_ADMIN_NAV_COUNTS);
  });

  it("falls back to empty when fetch throws", async () => {
    authedServerFetch.mockRejectedValue(new Error("network"));
    const counts = await getAdminNavCounts();
    expect(counts).toEqual(EMPTY_ADMIN_NAV_COUNTS);
  });
});

describe("getFinanceAdminNavCounts", () => {
  beforeEach(() => {
    authedServerFetch.mockReset();
  });

  it("returns finance subset from full nav counts", async () => {
    authedServerFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ...EMPTY_ADMIN_NAV_COUNTS,
          manualReviewCount: 4,
          disputesOpen: 2,
          payoutsFailed: 1,
          submissionsPending: 99,
        },
      }),
    });
    const counts = await getFinanceAdminNavCounts();
    expect(counts.manualReviewCount).toBe(4);
    expect(counts.disputesOpen).toBe(2);
    expect(counts.payoutsFailed).toBe(1);
    expect(counts.submissionsPending).toBe(0);
  });
});
