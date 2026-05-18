import { describe, expect, it } from "vitest";
import { CompositeErrorClassifier } from "./composite-error.classifier.js";

function pgLikeError(message: string, code: string): Error {
  const e = new Error(message);
  Object.assign(e, { code });
  return e;
}

describe("CompositeErrorClassifier", () => {
  const classifier = new CompositeErrorClassifier();

  it("classifies Postgres undefined_table (42P01) as 503 database_schema_incomplete", () => {
    const err = pgLikeError('relation "impersonation_session" does not exist', "42P01");
    const c = classifier.classify(err);
    expect(c.status).toBe(503);
    expect(c.code).toBe("database_schema_incomplete");
    expect(c.severity).toBe("error");
    expect(c.message).toContain("impersonation_session");
  });

  it("uses operator-facing copy for 42P01 in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const err = pgLikeError('relation "impersonation_session" does not exist', "42P01");
      const c = classifier.classify(err);
      expect(c.message).toContain("migrations");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("classifies Postgres foreign_key_violation (23503) as 400 foreign_key_violation", () => {
    const err = pgLikeError('insert violates foreign key constraint "x"', "23503");
    const c = classifier.classify(err);
    expect(c.status).toBe(400);
    expect(c.code).toBe("foreign_key_violation");
    expect(c.severity).toBe("warn");
  });

  it("finds Postgres code on error.cause (Drizzle-style wrapping)", () => {
    const inner = pgLikeError('relation "impersonation_session" does not exist', "42P01");
    const outer = new Error("Failed query");
    (outer as { cause: Error }).cause = inner;
    const c = classifier.classify(outer);
    expect(c.code).toBe("database_schema_incomplete");
    expect(c.status).toBe(503);
  });
});
