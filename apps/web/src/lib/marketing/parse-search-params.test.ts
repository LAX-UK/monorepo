import { describe, expect, it } from "vitest";
import {
  parseSearchEnding,
  parseSearchStatus,
  searchEndingLabel,
  searchStatusLabel,
} from "./parse-search-params";

describe("parseSearchStatus", () => {
  it("accepts known lot statuses", () => {
    expect(parseSearchStatus("active")).toBe("active");
    expect(parseSearchStatus("scheduled")).toBe("scheduled");
  });

  it("rejects unknown values", () => {
    expect(parseSearchStatus("live")).toBeUndefined();
  });
});

describe("parseSearchEnding", () => {
  it("accepts 24h window", () => {
    expect(parseSearchEnding("24h")).toBe("24h");
  });

  it("rejects unknown windows", () => {
    expect(parseSearchEnding("48h")).toBeUndefined();
  });
});

describe("searchStatusLabel", () => {
  it("maps active to Live now", () => {
    expect(searchStatusLabel("active")).toBe("Live now");
  });
});

describe("searchEndingLabel", () => {
  it("maps 24h window", () => {
    expect(searchEndingLabel("24h")).toBe("Ending within 24 hours");
  });
});
