import { describe, expect, it } from "vitest";
import { canManageCatalogue } from "./catalogue-auth.js";

describe("catalogue-auth", () => {
  it("canManageCatalogue accepts auction.manage or catalogue.write staff roles", () => {
    expect(canManageCatalogue("staff", "auction_manager")).toBe(true);
    expect(canManageCatalogue("staff", "catalogue_manager")).toBe(true);
    expect(canManageCatalogue("staff", "staff_viewer")).toBe(false);
    expect(canManageCatalogue("client", null)).toBe(false);
  });
});
