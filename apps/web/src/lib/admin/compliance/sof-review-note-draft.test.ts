import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSofReviewNote, readSofReviewNote, stashSofReviewNote } from "./sof-review-note-draft";

describe("sof review note draft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
    window.sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("puts a parked note back after the sign-in round trip", () => {
    stashSofReviewNote("doc-1", "Bank statement checked");
    expect(readSofReviewNote("doc-1")).toBe("Bank statement checked");
    expect(readSofReviewNote("doc-1")).toBe("Bank statement checked");
  });

  it("drops a parked note older than 30 minutes so it never hides a saved note", () => {
    stashSofReviewNote("doc-1", "Old draft");
    vi.setSystemTime(new Date("2026-11-08T10:31:00Z"));
    expect(readSofReviewNote("doc-1")).toBeNull();
  });

  it("clears the note after a save", () => {
    stashSofReviewNote("doc-1", "Draft");
    clearSofReviewNote("doc-1");
    expect(readSofReviewNote("doc-1")).toBeNull();
  });
});
