import { describe, expect, it } from "vitest";
import { poundsToPence, poundsToPenceOrNull } from "./pounds";

describe("poundsToPenceOrNull", () => {
  it("reads API amounts exactly, signed", () => {
    expect(poundsToPenceOrNull("1250.5")).toBe(125050);
    expect(poundsToPenceOrNull("-20.00")).toBe(-2000);
    expect(poundsToPenceOrNull(" 88,000.10 ")).toBe(8800010);
    expect(poundsToPenceOrNull("0.07")).toBe(7);
  });

  it.each(["", "abc", "100abc", "1.234", "--5", "1e3"])("refuses %j", (text) => {
    expect(poundsToPenceOrNull(text)).toBeNull();
  });

  it("reads an unreadable amount as zero when asked to", () => {
    expect(poundsToPence("100abc")).toBe(0);
    expect(poundsToPence("12.30")).toBe(1230);
  });
});
