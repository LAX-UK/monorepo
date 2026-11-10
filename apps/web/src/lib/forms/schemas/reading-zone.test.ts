import { describe, expect, it } from "vitest";
import { readingZone } from "./reading-zone";

describe("readingZone", () => {
  it("reads in the chosen place zone", () => {
    expect(readingZone("Europe/Paris")).toBe("Europe/Paris");
    expect(readingZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it.each(["", null, undefined, "UTC", "Etc/GMT+3", "Nowhere/Land"])(
    "falls back to London for %s",
    (zone) => {
      expect(readingZone(zone)).toBe("Europe/London");
    },
  );
});
