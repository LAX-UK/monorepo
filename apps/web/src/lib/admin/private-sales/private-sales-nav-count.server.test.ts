import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-private-sales.reader", () => ({
  getAdminDealsAttentionCount: () => count(),
}));

import { withPrivateSalesNavCount } from "./private-sales-nav-count.server";

beforeEach(() => vi.clearAllMocks());

describe("withPrivateSalesNavCount", () => {
  it("takes the count from the one cheap aggregate", async () => {
    count.mockResolvedValue({ total: 3, urgent: 1 });
    expect(
      await withPrivateSalesNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", ["sales_manager"]),
    ).toMatchObject({
      privateSalesAttention: 3,
      privateSalesUrgent: 1,
    });
  });

  it("leaves it out, rather than showing zero, when the Bid API does not answer", async () => {
    count.mockRejectedValue(new Error("down"));
    expect(
      await withPrivateSalesNavCount(
        { ...EMPTY_ADMIN_NAV_COUNTS, privateSalesAttention: 9 },
        "staff",
        ["sales_manager"],
      ),
    ).toMatchObject({ privateSalesAttention: 0, privateSalesUrgent: 0 });
  });

  it("does not ask for people who may not open deals", async () => {
    await withPrivateSalesNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", ["cataloguer"]);
    expect(count).not.toHaveBeenCalled();
  });
});
