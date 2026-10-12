import { describe, expect, it } from "vitest";
import { readCookie } from "./read-cookie";

describe("readCookie", () => {
  it("finds a cookie by exact name", () => {
    expect(readCookie("a=1; lax-shop-admin-csrf=tok%3D; b=2", "lax-shop-admin-csrf")).toBe("tok=");
  });

  it("does not match name prefixes and returns null when absent", () => {
    expect(readCookie("x-lax-shop-admin-csrf=1", "lax-shop-admin-csrf")).toBeNull();
    expect(readCookie("", "lax-shop-admin-csrf")).toBeNull();
  });
});
