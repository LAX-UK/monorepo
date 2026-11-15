import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({ getAdminPurchaseProblemOpenCount: vi.fn() }));
vi.mock("@/lib/data/http/admin-purchase-problems.reader", () => reader);

import { withPurchaseProblemsNavCount } from "./purchase-problems-nav-count.server";

beforeEach(() => reader.getAdminPurchaseProblemOpenCount.mockReset());

describe("withPurchaseProblemsNavCount", () => {
  it("counts the reports nobody has taken on, from the counts-only read", async () => {
    reader.getAdminPurchaseProblemOpenCount.mockResolvedValue(4);
    const counts = await withPurchaseProblemsNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", [
      "client_services",
    ]);
    expect(counts.purchaseProblemsOpen).toBe(4);
    expect(reader.getAdminPurchaseProblemOpenCount).toHaveBeenCalledWith();
  });

  it("does not ask the API of someone who cannot open the page", async () => {
    const counts = await withPurchaseProblemsNavCount(
      { ...EMPTY_ADMIN_NAV_COUNTS, purchaseProblemsOpen: 5 },
      "staff",
      ["finance"],
    );
    expect(counts.purchaseProblemsOpen).toBe(0);
    expect(reader.getAdminPurchaseProblemOpenCount).not.toHaveBeenCalled();
  });

  it("shows no count when the API does not answer", async () => {
    reader.getAdminPurchaseProblemOpenCount.mockRejectedValueOnce(new Error("down"));
    const counts = await withPurchaseProblemsNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", [
      "administrator",
    ]);
    expect(counts.purchaseProblemsOpen).toBe(0);
  });
});
