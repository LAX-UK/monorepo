import { describe, expect, it } from "vitest";
import { userRegisteredPayloadSchemaV1 } from "./payload-schemas.js";

describe("domain event payload timestamps", () => {
  it("accepts RFC 3339 offsets emitted by PostgreSQL JSON", () => {
    expect(
      userRegisteredPayloadSchemaV1.parse({
        userId: "subject-1",
        email: "person@example.com",
        name: "Example Person",
        source: "credential",
        createdAt: "2026-08-19T18:00:00+00:00",
      }),
    ).toMatchObject({ userId: "subject-1" });
  });

  it("rejects timestamps without a timezone", () => {
    expect(
      userRegisteredPayloadSchemaV1.safeParse({
        userId: "subject-1",
        email: "person@example.com",
        name: "Example Person",
        source: "credential",
        createdAt: "2026-08-19T18:00:00",
      }).success,
    ).toBe(false);
  });
});
