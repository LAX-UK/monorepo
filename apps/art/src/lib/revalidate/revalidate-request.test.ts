import { describe, expect, it } from "vitest";
import {
  createRevalidateRateLimiter,
  parseRevalidateTags,
  secretMatches,
} from "./revalidate-request";

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches("abcd", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
    expect(secretMatches(null, "")).toBe(false);
  });
});

describe("parseRevalidateTags", () => {
  it("de-duplicates allowed tags and rejects everything else", () => {
    expect(parseRevalidateTags({ tags: ["art:editorial", "art:editorial"] })).toEqual([
      "art:editorial",
    ]);
    expect(parseRevalidateTags({ tags: ["art:catalogue"] })).toBeNull();
    expect(parseRevalidateTags({ tags: [] })).toBeNull();
    expect(parseRevalidateTags({})).toBeNull();
    expect(parseRevalidateTags(null)).toBeNull();
  });
});

describe("createRevalidateRateLimiter", () => {
  it("blocks past the limit and recovers in the next window", () => {
    let now = 0;
    const limiter = createRevalidateRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.allow("b")).toBe(true);
    now = 1_000;
    expect(limiter.allow("a")).toBe(true);
  });
});
