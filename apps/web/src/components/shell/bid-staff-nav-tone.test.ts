import { describe, expect, it } from "vitest";
import { staffNavCountTone } from "./bid-staff-nav-tone";

describe("staffNavCountTone", () => {
  it.each([
    ["danger", "danger"],
    ["warning", "warning"],
    ["live", "attention"],
    ["default", "neutral"],
    [undefined, "neutral"],
  ] as const)("maps %s to %s", (badge, count) => {
    expect(staffNavCountTone(badge)).toBe(count);
  });
});
