import { describe, expect, it } from "vitest";
import { canManageCatalogue } from "./catalogue-auth.js";

describe("catalogue-auth", () => {
  it("canManageCatalogue accepts auction.manage or catalogue.write staff roles", () => {
    expect(canManageCatalogue("staff", ["sales_manager"])).toBe(true);
    expect(canManageCatalogue("staff", ["cataloguer"])).toBe(true);
    expect(canManageCatalogue("staff", ["read_only"])).toBe(false);
    expect(canManageCatalogue("client", [])).toBe(false);
  });
});
