import { buildLegalEntitiesListPageModel } from "@/lib/admin/people/build-legal-entities-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildLegalEntitiesListPageModel", () => {
  it("preserves filters and selected entity drawer param", () => {
    const model = buildLegalEntitiesListPageModel({
      status: "approved",
      kind: "organisation",
      q: "gallery",
      stripe: "1",
      offset: "25",
      limit: "50",
      entity: "le-123",
    });

    expect(model.listQueryParams).toEqual({
      limit: 50,
      offset: 25,
      status: "approved",
      kind: "organisation",
      q: "gallery",
      stripeDue: true,
    });
    expect(model.selectedEntityId).toBe("le-123");
    expect(model.stripeLens).toBe(true);
    expect(model.buildDrawerHref("le-456")).toContain("entity=le-456");
    expect(model.buildDrawerHref(null)).not.toContain("entity=");
  });
});
