import { describe, expect, it, vi } from "vitest";
import { payoutsListController } from "./payouts-list-controller";

vi.mock("@/lib/data/http/admin-payouts.reader", () => ({ getAdminPayoutsPage: vi.fn() }));

describe("payoutsListController", () => {
  it("reads the status, seller and an offered page size, and ignores anything else", () => {
    expect(
      payoutsListController.parseQuery({
        status: "paid",
        legalEntityId: " entity_1 ",
        limit: "100",
        offset: "50",
      }),
    ).toMatchObject({ status: "paid", legalEntityId: "entity_1", limit: 100, offset: 50 });
    expect(payoutsListController.parseQuery({ status: "nonsense", limit: "5000" })).toMatchObject({
      status: undefined,
      limit: 50,
    });
  });

  it("exports exactly what the list filters on, without the page", () => {
    const query = payoutsListController.parseQuery({
      status: "paid",
      legalEntityId: "entity_1",
      limit: "25",
      offset: "50",
    });
    expect(payoutsListController.exportFilters?.(query)).toEqual({
      status: "paid",
      legalEntityId: "entity_1",
    });
    expect(payoutsListController.exportFilters?.(payoutsListController.parseQuery({}))).toEqual({});
  });
});
