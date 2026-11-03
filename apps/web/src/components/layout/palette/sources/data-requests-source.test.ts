import { describe, expect, it } from "vitest";
import { dataRequestsPaletteQuery } from "./data-requests-source";

describe("dataRequestsPaletteQuery", () => {
  it("searches a whole reference, in either case", () => {
    expect(dataRequestsPaletteQuery("DR-0012")).toBe("DR-0012");
    expect(dataRequestsPaletteQuery(" dl-7f3c1a ")).toBe("DL-7F3C1A");
  });

  it("searches a full email address", () => {
    expect(dataRequestsPaletteQuery("lena@north.com")).toBe("lena@north.com");
  });

  it("never searches part of a reference or an email", () => {
    for (const partial of ["DR-", "dr-00", "DL-7F3", "lena@", "lena", "north.com", ""]) {
      expect(dataRequestsPaletteQuery(partial), partial).toBeNull();
    }
  });
});
