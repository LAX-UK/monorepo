import { describe, expect, it } from "vitest";
import { themeSchema, uiPreferencePatchSchema } from "./ui-preferences";

describe("themeSchema", () => {
  it("accepts light, dark, system", () => {
    expect(themeSchema.safeParse("light").success).toBe(true);
    expect(themeSchema.safeParse("dark").success).toBe(true);
    expect(themeSchema.safeParse("system").success).toBe(true);
  });

  it("rejects other strings", () => {
    expect(themeSchema.safeParse("auto").success).toBe(false);
  });
});

describe("uiPreferencePatchSchema", () => {
  it("accepts theme-only patch", () => {
    const r = uiPreferencePatchSchema.safeParse({ theme: "system" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.theme).toBe("system");
  });

  it("accepts single layout field", () => {
    const r = uiPreferencePatchSchema.safeParse({ viewLotsDefault: "grid" });
    expect(r.success).toBe(true);
  });

  it("rejects empty patch", () => {
    expect(uiPreferencePatchSchema.safeParse({}).success).toBe(false);
  });
});
