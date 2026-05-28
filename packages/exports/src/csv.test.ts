import { describe, expect, it } from "vitest";
import { escapeCsvCell, formatCsvDocument } from "./csv.js";

describe("escapeCsvCell", () => {
  it("prefixes formula-like values", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+1234")).toBe("'+1234");
  });

  it("quotes values with commas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });
});

describe("formatCsvDocument", () => {
  it("builds header and rows", () => {
    const csv = formatCsvDocument([{ key: "id", header: "id" }], [{ id: "1" }, { id: "2" }]);
    expect(csv).toBe("id\n1\n2");
  });
});
