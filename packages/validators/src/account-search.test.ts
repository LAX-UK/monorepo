import { describe, expect, it } from "vitest";
import { accountSearchQuerySchema } from "./account-search.js";

describe("accountSearchQuerySchema", () => {
  it("reads the text, a group and paging from the query string", () => {
    expect(
      accountSearchQuerySchema.parse({ q: "hockney", group: "bids", limit: "20", offset: "40" }),
    ).toEqual({ q: "hockney", group: "bids", limit: 20, offset: 40 });
  });

  it("defaults to the first page of every group", () => {
    expect(accountSearchQuerySchema.parse({ q: "hockney" })).toEqual({ q: "hockney", offset: 0 });
  });

  it("refuses an unknown group, a page too large and unknown parameters", () => {
    expect(accountSearchQuerySchema.safeParse({ q: "a", group: "users" }).success).toBe(false);
    expect(accountSearchQuerySchema.safeParse({ q: "a", limit: "51" }).success).toBe(false);
    expect(accountSearchQuerySchema.safeParse({ q: "a", sort: "name" }).success).toBe(false);
  });
});
