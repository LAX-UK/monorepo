import { describe, expect, it } from "vitest";
import { BidError } from "../lib/errors.js";
import { CompositeErrorClassifier } from "./composite-error.classifier.js";

function pgLikeError(message: string, code: string): Error {
  const e = new Error(message);
  Object.assign(e, { code });
  return e;
}

describe("CompositeErrorClassifier", () => {
  const classifier = new CompositeErrorClassifier();

  it("prefers domain validation (BidError) before Postgres in the chain", () => {
    const c = classifier.classify(new BidError("too low", 400));
    expect(c.status).toBe(400);
    expect(c.code).toBe("BidError");
    expect(c.message).toBe("too low");
  });

  it("classifies Postgres after domain branch returns null", () => {
    const err = pgLikeError('relation "x" does not exist', "42P01");
    const c = classifier.classify(err);
    expect(c.status).toBe(503);
    expect(c.code).toBe("database_schema_incomplete");
  });

  it("falls through to generic InternalError for unrelated errors", () => {
    const c = classifier.classify(new Error("boom"));
    expect(c.status).toBe(500);
    expect(c.code).toBe("InternalError");
  });
});
