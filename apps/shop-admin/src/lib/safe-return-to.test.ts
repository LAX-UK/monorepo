import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it("defaults empty values to /overview", () => {
    expect(safeReturnTo(undefined)).toBe("/overview");
    expect(safeReturnTo("")).toBe("/overview");
    expect(safeReturnTo("   ")).toBe("/overview");
  });

  it("accepts same-origin paths", () => {
    expect(safeReturnTo("/orders")).toBe("/orders");
    expect(safeReturnTo("/clients/abc?tab=1")).toBe("/clients/abc?tab=1");
  });

  it("rejects off-site and protocol-relative targets", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/overview");
    expect(safeReturnTo("//evil.example")).toBe("/overview");
    expect(safeReturnTo("/\\evil.example")).toBe("/overview");
  });

  it("honours custom fallback", () => {
    expect(safeReturnTo(null, "/")).toBe("/");
  });
});
