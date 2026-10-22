import { describe, expect, it } from "vitest";
import { londonIsoDate } from "./editorial-calendar-date.js";

describe("londonIsoDate", () => {
  it("rolls over at London midnight during BST, an hour before UTC", () => {
    expect(londonIsoDate(new Date("2026-08-27T22:59:59Z"))).toBe("2026-08-27");
    expect(londonIsoDate(new Date("2026-08-27T23:00:00Z"))).toBe("2026-08-28");
  });

  it("matches the UTC date during GMT", () => {
    expect(londonIsoDate(new Date("2026-12-01T23:59:59Z"))).toBe("2026-12-01");
    expect(londonIsoDate(new Date("2026-12-02T00:00:00Z"))).toBe("2026-12-02");
  });
});
