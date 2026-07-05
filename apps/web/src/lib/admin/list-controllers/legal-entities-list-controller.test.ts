import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminLegalEntityList = vi.fn();

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminLegalEntityList: (...args: unknown[]) => getAdminLegalEntityList(...args),
}));

import { legalEntitiesListController } from "./legal-entities-list-controller";

describe("legalEntitiesListController.fetch", () => {
  beforeEach(() => {
    getAdminLegalEntityList.mockReset();
    getAdminLegalEntityList.mockResolvedValue({ rows: [], total: 0 });
  });

  it("forwards kind and maps stripeLens to stripeDue", async () => {
    await legalEntitiesListController.fetch({
      limit: 25,
      offset: 0,
      kind: "organisation",
      stripeLens: true,
    });

    expect(getAdminLegalEntityList).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      kind: "organisation",
      stripeDue: true,
    });
  });

  it("omits optional filters when unset", async () => {
    await legalEntitiesListController.fetch({
      limit: 25,
      offset: 0,
      status: "approved",
      q: "Acme",
    });

    expect(getAdminLegalEntityList).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      status: "approved",
      q: "Acme",
    });
  });
});
