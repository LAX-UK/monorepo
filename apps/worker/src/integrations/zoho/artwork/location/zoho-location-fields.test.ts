import { describe, expect, it } from "vitest";
import { ZOHO_LOCATION_MAX, zohoLocationValue } from "./zoho-location-fields.js";

describe("zohoLocationValue", () => {
  it("is the location's name, marked when retired, and empty when none is recorded", () => {
    expect(zohoLocationValue({ id: "l1", name: "Store room", status: "active" })).toBe(
      "Store room",
    );
    expect(zohoLocationValue({ id: "l1", name: "Framer", status: "retired" })).toBe(
      "Framer (retired)",
    );
    expect(zohoLocationValue(null)).toBeNull();
  });

  it("never exceeds Zoho's 255 characters", () => {
    const value = zohoLocationValue({ id: "l1", name: "é".repeat(300), status: "retired" });
    expect([...(value ?? "")]).toHaveLength(ZOHO_LOCATION_MAX);
  });
});
