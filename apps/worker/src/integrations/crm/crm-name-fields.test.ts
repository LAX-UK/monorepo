import { describe, expect, it } from "vitest";
import { splitDisplayName } from "./crm-name-fields.js";
import { landingPageForCrm } from "./crm-readers.js";

describe("splitDisplayName", () => {
  it("makes a one-word name the surname Zoho requires", () => {
    expect(splitDisplayName("Ada", "ada@example.test")).toEqual({
      firstName: null,
      lastName: "Ada",
    });
  });

  it("falls back to the email's local part, then to Customer", () => {
    expect(splitDisplayName("   ", "ada@example.test")).toEqual({
      firstName: null,
      lastName: "ada",
    });
    expect(splitDisplayName("", "@example.test")).toEqual({
      firstName: null,
      lastName: "Customer",
    });
  });

  it("cuts a long one-word name to Zoho's 80 characters", () => {
    const { lastName } = splitDisplayName("x".repeat(120), "a@example.test");
    expect(lastName).toHaveLength(80);
  });

  it("cuts first names to 40 and surnames to 80", () => {
    const { firstName, lastName } = splitDisplayName(
      `${"f".repeat(50)} ${"l".repeat(90)}`,
      "a@example.test",
    );
    expect(firstName).toHaveLength(40);
    expect(lastName).toHaveLength(80);
  });
});

describe("landingPageForCrm", () => {
  it("keeps a landing page that fits", () => {
    expect(landingPageForCrm("https://lax.example/sale?utm_source=x")).toBe(
      "https://lax.example/sale?utm_source=x",
    );
  });

  it("drops the query of a long landing page, then cuts it to 255", () => {
    const long = `https://lax.example/sale?gclid=${"a".repeat(300)}`;
    expect(landingPageForCrm(long)).toBe("https://lax.example/sale");
    const longPath = `https://lax.example/${"p".repeat(300)}`;
    expect(landingPageForCrm(longPath)).toHaveLength(255);
  });
});
