import {
  formatSignupPersona,
  resolveSignupPersonaPresentation,
  signupPersonaFilterLabel,
  signupPersonaFilterOptions,
  signupPersonaPaletteKeys,
} from "@/lib/presenters/signup-persona/signup-persona-registry";
import { describe, expect, it } from "vitest";

describe("signup-persona-registry", () => {
  it("assigns a unique palette key for every persona case", () => {
    expect(new Set(signupPersonaPaletteKeys).size).toBe(signupPersonaPaletteKeys.length);
    expect(signupPersonaPaletteKeys).toHaveLength(3);
  });

  it("resolves individual presentation", () => {
    expect(resolveSignupPersonaPresentation("individual")).toMatchObject({
      label: "Individual",
      ariaLabel: "Individual signup persona",
      paletteKey: "individual",
      iconKey: "user",
    });
  });

  it("resolves organisation presentation", () => {
    expect(resolveSignupPersonaPresentation("organisation")).toMatchObject({
      label: "Organisation",
      ariaLabel: "Organisation signup persona",
      paletteKey: "organisation",
      iconKey: "building",
    });
  });

  it("resolves unset presentation for null, empty, and unknown values", () => {
    for (const value of [null, undefined, "", "unknown"]) {
      expect(resolveSignupPersonaPresentation(value)).toMatchObject({
        label: "Not set",
        paletteKey: "unset",
        iconKey: "help",
      });
    }
  });

  it("preserves formatSignupPersona compatibility", () => {
    expect(formatSignupPersona("individual")).toBe("Individual");
    expect(formatSignupPersona("organisation")).toBe("Organisation");
    expect(formatSignupPersona(null)).toBe("Not set");
  });

  it("exports filter options with registry labels", () => {
    expect(signupPersonaFilterOptions).toEqual([
      { value: "individual", label: "Individual" },
      { value: "organisation", label: "Organisation" },
      { value: "none", label: "Not set" },
    ]);
  });

  it("maps filter labels for all filter values", () => {
    expect(signupPersonaFilterLabel("individual")).toBe("Individual");
    expect(signupPersonaFilterLabel("organisation")).toBe("Organisation");
    expect(signupPersonaFilterLabel("none")).toBe("Not set");
  });
});
