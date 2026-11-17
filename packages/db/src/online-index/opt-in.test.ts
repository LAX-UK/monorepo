import { describe, expect, it } from "vitest";
import { ONLINE_INDEX_STEP_ENV, onlineIndexStepOptedIn } from "./index.js";

describe("onlineIndexStepOptedIn", () => {
  it("is on only for ONLINE_INDEX_STEP=1", () => {
    expect(ONLINE_INDEX_STEP_ENV).toBe("ONLINE_INDEX_STEP");
    expect(onlineIndexStepOptedIn({ ONLINE_INDEX_STEP: "1" })).toBe(true);
  });

  it("is off when unset, empty or 0, as in local and CI db:migrate", () => {
    expect(onlineIndexStepOptedIn({})).toBe(false);
    expect(onlineIndexStepOptedIn({ ONLINE_INDEX_STEP: "" })).toBe(false);
    expect(onlineIndexStepOptedIn({ ONLINE_INDEX_STEP: "0" })).toBe(false);
  });

  it.each(["true", "yes", " 1", "2"])("rejects %j instead of silently skipping", (value) => {
    expect(() => onlineIndexStepOptedIn({ ONLINE_INDEX_STEP: value })).toThrow(/must be 1/);
  });
});
