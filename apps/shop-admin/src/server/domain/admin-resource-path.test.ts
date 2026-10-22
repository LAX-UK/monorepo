import { describe, expect, it } from "vitest";
import { encodeAdminResourcePath } from "./admin-resource-path";

describe("encodeAdminResourcePath", () => {
  it("keeps the query string intact so the filters reach the API", () => {
    expect(encodeAdminResourcePath("enquiries?limit=50&status=new&q=a%20b")).toBe(
      "enquiries?limit=50&status=new&q=a%20b",
    );
  });

  it("encodes each path segment", () => {
    expect(encodeAdminResourcePath("/enquiries/general/a b?limit=5")).toBe(
      "enquiries/general/a%20b?limit=5",
    );
  });

  it("encodes a segment that tries to climb out of the resource", () => {
    expect(encodeAdminResourcePath("orders/..%2Fstaff")).toBe("orders/..%252Fstaff");
  });

  it("leaves a path without a query unchanged", () => {
    expect(encodeAdminResourcePath("session")).toBe("session");
  });
});
