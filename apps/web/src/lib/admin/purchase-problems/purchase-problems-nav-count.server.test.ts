import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({ getAdminPurchaseProblems: vi.fn() }));
vi.mock("@/lib/data/http/admin-purchase-problems.reader", () => reader);

import { withPurchaseProblemsNavCount } from "./purchase-problems-nav-count.server";

beforeEach(() => reader.getAdminPurchaseProblems.mockReset());

describe("withPurchaseProblemsNavCount", () => {
  it("counts the reports nobody has taken on, asking for one row only", async () => {
    reader.getAdminPurchaseProblems.mockResolvedValue({
      counts: { open: 4, in_progress: 2, resolved: 9 },
    });
    const counts = await withPurchaseProblemsNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", [
      "client_services",
    ]);
    expect(counts.purchaseProblemsOpen).toBe(4);
    const query = reader.getAdminPurchaseProblems.mock.calls[0]?.[0] as URLSearchParams;
    expect(query.get("limit")).toBe("1");
  });

  it("does not ask the API of someone who cannot open the page", async () => {
    const counts = await withPurchaseProblemsNavCount(
      { ...EMPTY_ADMIN_NAV_COUNTS, purchaseProblemsOpen: 5 },
      "staff",
      ["finance"],
    );
    expect(counts.purchaseProblemsOpen).toBe(0);
    expect(reader.getAdminPurchaseProblems).not.toHaveBeenCalled();
  });

  it("shows no count when the API does not answer", async () => {
    reader.getAdminPurchaseProblems.mockRejectedValueOnce(new Error("down"));
    const counts = await withPurchaseProblemsNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", [
      "administrator",
    ]);
    expect(counts.purchaseProblemsOpen).toBe(0);
  });
});
