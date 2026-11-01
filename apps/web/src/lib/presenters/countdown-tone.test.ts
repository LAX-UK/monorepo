import { describe, expect, it } from "vitest";
import { countdownTone, countdownToneClass } from "./countdown-tone";

const MINUTE = 60_000;

describe("countdown tone", () => {
  it("stays calm while there is more than an hour left", () => {
    expect(countdownTone(2 * 24 * 60 * MINUTE)).toBe("calm");
    expect(countdownTone(61 * MINUTE)).toBe("calm");
  });

  it("warns in the final hour", () => {
    expect(countdownTone(59 * MINUTE)).toBe("soon");
    expect(countdownTone(3 * MINUTE)).toBe("soon");
  });

  it("is final in the last minutes and once closed", () => {
    expect(countdownTone(MINUTE)).toBe("final");
    expect(countdownTone(0)).toBe("final");
  });

  it("is final during an extension, whatever the time left", () => {
    expect(countdownTone(3 * 60 * MINUTE, { extended: true })).toBe("final");
  });

  it("names one token class per tone", () => {
    expect(countdownToneClass("calm")).toBe("text-countdown-calm");
    expect(countdownToneClass("soon")).toBe("text-countdown-soon");
    expect(countdownToneClass("final")).toBe("text-countdown-final");
  });
});
