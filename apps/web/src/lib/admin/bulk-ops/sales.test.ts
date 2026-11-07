import { describe, expect, it, vi } from "vitest";

const cancelSale = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/admin-sales", () => ({ adminBulkSalesResultAction: vi.fn() }));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminCancelSaleResultAction: (...args: unknown[]) => cancelSale(...args),
  adminPublishSaleResultAction: vi.fn(),
}));

const { bulkCancelPreflightWarning, getSaleBulkOperations } = await import("./sales");

describe("bulkCancelPreflightWarning", () => {
  const rows = [
    { saleId: "s1", status: "draft" as const },
    { saleId: "s2", status: "active" as const },
    { saleId: "s3", status: "scheduled" as const },
  ];

  it("returns null when no liveish sales selected", () => {
    expect(bulkCancelPreflightWarning(["s1"], rows)).toBeNull();
  });

  it("warns when a live sale is selected", () => {
    expect(bulkCancelPreflightWarning(["s2"], rows)).toContain("approved registrations");
  });

  it("counts multiple liveish sales", () => {
    expect(bulkCancelPreflightWarning(["s2", "s3"], rows)).toContain("2 selected sales");
  });
});

describe("bulk sale cancel and a stale sign-in", () => {
  const cancel = () => {
    const op = getSaleBulkOperations(true).find((x) => x.id === "cancel");
    if (!op) throw new Error("no cancel operation");
    return op;
  };

  it("stops at the first stale sign-in and hands the code to the page", async () => {
    cancelSale.mockReset();
    cancelSale.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      status: 403,
      errorCode: "step_up_required",
    });
    const result = await cancel().run(["s1", "s2", "s3"], { reason: "Venue closed" });
    expect(result).toMatchObject({ ok: false, errorCode: "step_up_required" });
    expect(cancelSale).toHaveBeenCalledTimes(1);
  });

  it("still reports ordinary failures per sale", async () => {
    cancelSale.mockReset();
    cancelSale.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "x" });
    const result = await cancel().run(["s1", "s2"], { reason: "Venue closed" });
    expect(result.ok).toBe(false);
    expect((result as { errorCode?: string }).errorCode).toBeUndefined();
    expect(cancelSale).toHaveBeenCalledTimes(2);
  });
});
