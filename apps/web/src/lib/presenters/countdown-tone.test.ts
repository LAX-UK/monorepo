import { describe, expect, it } from "vitest";
import { countdownToneClass, countdownToneForRemaining } from "./countdown-tone";

const MINUTE = 60_000;

describe("countdown tone", () => {
  it("stays calm while there is more than an hour left", () => {
    expect(countdownToneForRemaining(2 * 24 * 60 * MINUTE)).toBe("calm");
    expect(countdownToneForRemaining(61 * MINUTE)).toBe("calm");
  });

  it("warns in the final hour", () => {
    expect(countdownToneForRemaining(59 * MINUTE)).toBe("soon");
    expect(countdownToneForRemaining(11 * MINUTE)).toBe("soon");
  });

  it("is urgent in the final minutes and once closed", () => {
    expect(countdownToneForRemaining(9 * MINUTE)).toBe("urgent");
    expect(countdownToneForRemaining(0)).toBe("urgent");
  });

  it("is urgent during an extension, whatever the time left", () => {
    expect(countdownToneForRemaining(3 * 60 * MINUTE, { extended: true })).toBe("urgent");
  });

  it("names one token class per tone", () => {
    expect(countdownToneClass("calm")).toBe("text-countdown-calm");
    expect(countdownToneClass("soon")).toBe("text-countdown-soon");
    expect(countdownToneClass("urgent")).toBe("text-countdown-urgent");
  });
});
