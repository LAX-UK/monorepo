import type { IAdminLegalEntityBrowseReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminLegalEntityBrowseQueryService } from "./admin-legal-entity-browse-query.service.js";

describe("AdminLegalEntityBrowseQueryService", () => {
  it("delegates searchLegalEntitiesBrowse to the browse reader", async () => {
    const params = { limit: 20, offset: 0, q: "gallery" };
    const result = {
      rows: [],
      total: 0,
      summary: {
        total: 0,
        byStatus: {
          lead: 0,
          docs_requested: 0,
          docs_received: 0,
          under_review: 0,
          connect_pending: 0,
          approved: 0,
          restricted: 0,
          rejected: 0,
          archived: 0,
        },
        stripeDueCount: 0,
        byKind: { individual: 0, organisation: 0 },
      },
    };
    const reader: IAdminLegalEntityBrowseReader = {
      searchLegalEntitiesBrowse: vi.fn().mockResolvedValue(result),
      summarizeLegalEntitiesBrowse: vi.fn(),
    };
    const svc = new AdminLegalEntityBrowseQueryService(reader);

    await expect(svc.searchLegalEntitiesBrowse(params)).resolves.toEqual(result);
    expect(reader.searchLegalEntitiesBrowse).toHaveBeenCalledWith(params);
  });

  it("returns paginated envelope fields from getPage", async () => {
    const params = { limit: 10, offset: 5, status: "approved" as const };
    const result = {
      rows: [
        {
          id: "le-1",
          displayName: "Gallery",
          status: "approved",
          kind: "organisation",
          subkind: "gallery",
          updatedAt: new Date(),
          stripeDueCount: 0,
        },
      ],
      total: 1,
      summary: {
        total: 1,
        byStatus: {
          lead: 0,
          docs_requested: 0,
          docs_received: 0,
          under_review: 0,
          connect_pending: 0,
          approved: 1,
          restricted: 0,
          rejected: 0,
          archived: 0,
        },
        stripeDueCount: 0,
        byKind: { individual: 0, organisation: 1 },
      },
    };
    const reader: IAdminLegalEntityBrowseReader = {
      searchLegalEntitiesBrowse: vi.fn().mockResolvedValue(result),
      summarizeLegalEntitiesBrowse: vi.fn(),
    };
    const svc = new AdminLegalEntityBrowseQueryService(reader);

    await expect(svc.getPage(params)).resolves.toEqual({
      rows: result.rows,
      total: 1,
      offset: 5,
      limit: 10,
      summary: result.summary,
    });
  });
});
