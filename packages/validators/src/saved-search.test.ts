import { describe, expect, it } from "vitest";
import { savedSearchEmailBodySchema } from "./saved-search.js";

describe("savedSearchEmailBodySchema", () => {
  it("accepts on or off", () => {
    expect(savedSearchEmailBodySchema.parse({ notifyEmail: true })).toEqual({ notifyEmail: true });
    expect(savedSearchEmailBodySchema.parse({ notifyEmail: false })).toEqual({
      notifyEmail: false,
    });
  });

  it("needs a real boolean", () => {
    expect(savedSearchEmailBodySchema.safeParse({}).success).toBe(false);
    expect(savedSearchEmailBodySchema.safeParse({ notifyEmail: "yes" }).success).toBe(false);
  });
});
