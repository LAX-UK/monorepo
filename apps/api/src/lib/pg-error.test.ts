import { describe, expect, it } from "vitest";
import { findPostgresError } from "./pg-error.js";

describe("findPostgresError", () => {
  it("returns null for plain Error without code", () => {
    expect(findPostgresError(new Error("oops"))).toBeNull();
  });

  it("returns code on Error with Postgres code property", () => {
    const e = new Error('relation "t" does not exist');
    Object.assign(e, { code: "42P01" });
    expect(findPostgresError(e)).toEqual({
      code: "42P01",
      message: e.message,
    });
  });
});
