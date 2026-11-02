import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { describe, expect, it } from "vitest";
import { formatRemaining } from "./format";

describe("formatRemaining", () => {
  it("is the shared countdown formatter", () => {
    expect(formatRemaining).toBe(formatCountdownForDisplay);
  });
});
