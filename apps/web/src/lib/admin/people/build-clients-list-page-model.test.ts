import { buildClientsListPageModel } from "@/lib/admin/people/build-clients-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildClientsListPageModel", () => {
  it("fixes role=client and preserves preview drawer param", () => {
    const model = buildClientsListPageModel({
      q: "alice",
      emailVerified: "1",
      offset: "25",
      limit: "50",
      client: "user-123",
    });

    expect(model.listQueryParams).toMatchObject({
      limit: 50,
      offset: 25,
      role: "client",
      q: "alice",
      emailVerified: true,
    });
    expect(model.selectedClientId).toBe("user-123");
    expect(model.buildDrawerHref("user-456")).toContain("client=user-456");
    expect(model.buildDrawerHref(null)).not.toContain("client=");
  });
});
