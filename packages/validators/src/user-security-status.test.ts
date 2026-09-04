import { describe, expect, it } from "vitest";
import { securityStatusAvailableSchema } from "./user";

describe("securityStatusAvailableSchema", () => {
  it.each([true, false])("accepts explicit availability %s", (available) => {
    expect(securityStatusAvailableSchema.parse(available)).toBe(available);
  });

  it("rejects missing availability", () => {
    expect(securityStatusAvailableSchema.safeParse(undefined).success).toBe(false);
  });
});
