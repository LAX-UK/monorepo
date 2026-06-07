import { describe, expect, it } from "vitest";
import { canTransition, nextStatus } from "./submission-state-machine.js";

describe("submission-state-machine", () => {
  it("allows submit from draft", () => {
    expect(canTransition("draft", "submit")).toBe(true);
    expect(nextStatus("draft", "submit")).toBe("submitted");
  });

  it("allows accept then convert", () => {
    expect(nextStatus("under_review", "accept")).toBe("approved");
    expect(nextStatus("approved", "convert")).toBe("converted");
  });

  it("rejects convert from under_review", () => {
    expect(canTransition("under_review", "convert")).toBe(false);
  });
});
