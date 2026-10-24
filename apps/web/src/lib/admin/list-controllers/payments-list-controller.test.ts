import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));
vi.mock("@/lib/data/http/admin.server", () => ({ getAdminPaymentsListPage: getPage }));

const { paymentsListController } = await import("./payments-list-controller");

describe("paymentsListController", () => {
  beforeEach(() => {
    getPage.mockReset();
    getPage.mockResolvedValue({ rows: [], total: 0, offset: 0, limit: 50, summary: {} });
  });

  it("asks for 50 payments per page when the URL names no limit", async () => {
    const query = paymentsListController.parseQuery({});
    expect(query.limit).toBe(50);
    await paymentsListController.fetch(query);
    expect(getPage).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it("passes known fulfilment statuses and the Xero state, dropping unknown values", async () => {
    const query = paymentsListController.parseQuery({
      fulfilment: "in_transit,lost_at_sea,delivered",
      xero: "sync_error",
    });
    await paymentsListController.fetch(query);
    expect(getPage).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      fulfilment: ["in_transit", "delivered"],
      xero: "sync_error",
    });
    expect(paymentsListController.parseQuery({ xero: "nonsense" }).xero).toBeUndefined();
  });
});
