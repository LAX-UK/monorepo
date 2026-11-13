import { describe, expect, it } from "vitest";
import * as validators from "./index.js";
import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES } from "./ui-preference-defaults.js";
import { themeSchema } from "./ui-preferences.js";

describe("theme preference values", () => {
  it("keeps the same theme values and default", () => {
    expect(themeSchema.options).toEqual(["light", "dark", "system"]);
    expect(THEME_PREFERENCES).toEqual(themeSchema.options);
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
    expect(themeSchema.safeParse(DEFAULT_THEME_PREFERENCE).success).toBe(true);
  });

  it("is still exported from the package root", () => {
    expect(validators.DEFAULT_THEME_PREFERENCE).toBe("system");
    expect(validators.themeSchema).toBe(themeSchema);
    expect(typeof validators.marketingAttributionPutBodySchema.safeParse).toBe("function");
    expect(typeof validators.parseMarketingAttributionSnapshot).toBe("function");
  });
});
