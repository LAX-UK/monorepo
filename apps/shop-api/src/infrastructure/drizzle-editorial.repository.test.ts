import { describe, expect, it } from "vitest";
import { createStubEditorialRepository } from "../test-support/stub-editorial-repository.js";
import { withSlugConflicts } from "./drizzle-editorial.repository.js";

function uniqueViolation(constraint: string) {
  return Object.assign(new Error("duplicate key"), { code: "23505", constraint });
}

describe("withSlugConflicts", () => {
  it("maps a slug unique violation to a 409 conflict", async () => {
    const repo = withSlugConflicts(
      createStubEditorialRepository({
        createVenue: async () => {
          throw new Error("query failed", {
            cause: uniqueViolation("shop_editorial_venue_slug_uid"),
          });
        },
      }),
    );
    await expect(
      repo.createVenue({} as Parameters<typeof repo.createVenue>[0]),
    ).rejects.toMatchObject({ statusCode: 409, message: "Slug is already in use" });
  });

  it("rethrows other database errors unchanged", async () => {
    const failure = uniqueViolation("shop_editorial_placement_slot_position_uid");
    const repo = withSlugConflicts(
      createStubEditorialRepository({
        updatePage: async () => {
          throw failure;
        },
      }),
    );
    await expect(repo.updatePage("id", {} as Parameters<typeof repo.updatePage>[1])).rejects.toBe(
      failure,
    );
  });
});
