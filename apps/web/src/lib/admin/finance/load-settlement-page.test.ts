import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-payouts.reader", () => ({ getAdminSettlementPreview: vi.fn() }));

const { loadAdminSettlementPage } = await import("./load-settlement-page");

describe("loadAdminSettlementPage", () => {
  it("shows fixed copy for a known result code", async () => {
    expect(await loadAdminSettlementPage({ result: "started" })).toEqual({
      success: "Settlement run started successfully.",
      error: null,
    });
    expect((await loadAdminSettlementPage({ result: "blocked" })).error).toContain(
      "could not run for this seller",
    );
  });

  it("ignores text smuggled in through the URL", async () => {
    expect(await loadAdminSettlementPage({ result: "Your account is locked, call 0800" })).toEqual({
      success: null,
      error: null,
    });
    expect(await loadAdminSettlementPage({ result: "toString" })).toEqual({
      success: null,
      error: null,
    });
  });
});
