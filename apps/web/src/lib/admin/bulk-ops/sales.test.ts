import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin-sales", () => ({
  adminPublishSaleResultAction: vi.fn(),
  adminCancelSaleResultAction: vi.fn(),
}));

import { getSaleBulkOperations } from "./sales";

describe("getSaleBulkOperations", () => {
  it("includes publish and cancel only for auction managers", () => {
    const managerOps = getSaleBulkOperations(true);
    expect(managerOps.map((op) => op.id)).toEqual(["copy-ids", "publish", "cancel"]);

    const catalogueOps = getSaleBulkOperations(false);
    expect(catalogueOps.map((op) => op.id)).toEqual(["copy-ids"]);
  });
});
