import { describe, expect, it } from "vitest";
import { parseAdminLegalEntitiesPageBody } from "./admin-legal-entities.shared";

describe("parseAdminLegalEntitiesPageBody", () => {
  it("parses standard list envelope with meta.summary", () => {
    const page = parseAdminLegalEntitiesPageBody(
      {
        data: [
          {
            id: "le-1",
            displayName: "Gallery",
            status: "approved",
            kind: "organisation",
            subkind: "gallery",
            updatedAt: "2026-01-01T00:00:00.000Z",
            stripeDueCount: 0,
          },
        ],
        meta: {
          total: 2,
          limit: 25,
          offset: 0,
          summary: {
            total: 2,
            byStatus: {
              lead: 0,
              docs_requested: 0,
              docs_received: 0,
              under_review: 0,
              connect_pending: 0,
              approved: 2,
              restricted: 0,
              rejected: 0,
              archived: 0,
            },
            stripeDueCount: 1,
            byKind: { individual: 0, organisation: 2 },
          },
        },
      },
      { limit: 25, offset: 0 },
    );

    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(page.summary.stripeDueCount).toBe(1);
    expect(page.summary.byKind.organisation).toBe(2);
    expect(page.hasNextPage).toBe(true);
  });
});
