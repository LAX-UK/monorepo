import { describe, expect, it } from "vitest";
import { buildStaffProducts } from "./staff-products.js";

const hrefs = { "bid-admin": "https://bid.example.test/admin", "lax-admin": "/" };
const ids = (products: { id: string }[]) => products.map((p) => p.id);

describe("buildStaffProducts", () => {
  it("lists only the tool you are in when nothing else is accessible", () => {
    expect(ids(buildStaffProducts({ current: "lax-admin", accessible: [], hrefs }))).toEqual([
      "lax-admin",
    ]);
  });

  it("lists the other tool when the person can open it", () => {
    const products = buildStaffProducts({
      current: "bid-admin",
      accessible: ["bid-admin", "lax-admin"],
      hrefs,
    });
    expect(ids(products)).toEqual(["bid-admin", "lax-admin"]);
    expect(products[1]?.href).toBe("/");
  });

  it("hides an accessible tool whose address is not configured", () => {
    const products = buildStaffProducts({
      current: "bid-admin",
      accessible: ["lax-admin"],
      hrefs: { "bid-admin": "/admin", "lax-admin": null },
    });
    expect(ids(products)).toEqual(["bid-admin"]);
  });

  it("keeps the current tool even if the access answer omits it", () => {
    const products = buildStaffProducts({ current: "lax-admin", accessible: ["bid-admin"], hrefs });
    expect(ids(products)).toEqual(["bid-admin", "lax-admin"]);
  });
});
