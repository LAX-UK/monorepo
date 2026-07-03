import { describe, expect, it, vi } from "vitest";
import type { IAdminLegalEntityBrowseReader } from "../../repositories/interfaces/admin-legal-entity-browse.reader.js";
import { AdminLegalEntityBrowseQueryService } from "./admin-legal-entity-browse-query.service.js";

describe("AdminLegalEntityBrowseQueryService", () => {
  it("delegates to the browse reader", async () => {
    const params = { limit: 20, offset: 0, q: "gallery" };
    const result = { rows: [], total: 0 };
    const reader: IAdminLegalEntityBrowseReader = {
      searchLegalEntitiesBrowse: vi.fn().mockResolvedValue(result),
    };
    const svc = new AdminLegalEntityBrowseQueryService(reader);

    await expect(svc.searchLegalEntitiesBrowse(params)).resolves.toEqual(result);
    expect(reader.searchLegalEntitiesBrowse).toHaveBeenCalledWith(params);
  });
});
