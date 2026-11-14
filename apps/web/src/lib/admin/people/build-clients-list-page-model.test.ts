import { buildClientsListPageModel } from "@/lib/admin/people/build-clients-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildClientsListPageModel", () => {
  it("fixes role=client", () => {
    const model = buildClientsListPageModel({
      q: "alice",
      emailVerified: "1",
      offset: "25",
      limit: "50",
    });

    expect(model.listQueryParams).toMatchObject({
      limit: 50,
      offset: 25,
      role: "client",
      q: "alice",
      emailVerified: true,
    });
  });
});
