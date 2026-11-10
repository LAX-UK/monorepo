import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, workday } from "./collection-journey-ids.js";

describe("working days", () => {
  it("counts Monday to Friday, forwards and back", () => {
    // Tuesday 10 Nov 2026.
    expect(workday("2026-11-10", 2)).toBe("2026-11-12");
    expect(workday("2026-11-10", 4)).toBe("2026-11-16");
    expect(workday("2026-11-10", -1)).toBe("2026-11-09");
    expect(workday("2026-11-10", -2)).toBe("2026-11-06");
  });

  it("starts from the next working day when today is a weekend", () => {
    expect(isoWeekday("2026-11-14")).toBe(6);
    expect(workday("2026-11-14", 0)).toBe("2026-11-16");
    expect(workday("2026-11-14", 1)).toBe("2026-11-17");
    expect(workday("2026-11-14", -1)).toBe("2026-11-12");
  });

  it("adds days across a month end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
