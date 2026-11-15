import { describe, expect, it } from "vitest";
import { parseCheckInLimit } from "./check-in-limit";

describe("parseCheckInLimit", () => {
  it("treats blank as no cap", () => {
    expect(parseCheckInLimit("")).toEqual({ ok: true, pence: null });
    expect(parseCheckInLimit("   ")).toEqual({ ok: true, pence: null });
  });

  it("reads amounts into pence", () => {
    expect(parseCheckInLimit("5,000")).toEqual({ ok: true, pence: 500000 });
    expect(parseCheckInLimit(" 2500.50 ")).toEqual({ ok: true, pence: 250050 });
  });

  it.each(["100abc", "0", "0.00", "-5", "abc", "1.234"])("refuses %j", (text) => {
    expect(parseCheckInLimit(text)).toEqual({ ok: false });
  });
});
