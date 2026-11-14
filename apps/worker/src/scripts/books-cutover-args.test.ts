import { describe, expect, it } from "vitest";
import { londonDayStart, parseBackfillArgs, parseImportArgs } from "./books-cutover-args.js";

describe("books cutover command options", () => {
  it("reads the cutover day as 00:00 London, in winter and in summer", () => {
    expect(londonDayStart("2027-01-01").toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(londonDayStart("2027-04-01").toISOString()).toBe("2027-03-31T23:00:00.000Z");
    expect(() => londonDayStart("01/01/2027")).toThrow();
  });

  it("caps the import at its share of the daily call budget, however much is asked", () => {
    const env = { ZOHO_BOOKS_DAILY_CALL_BUDGET: "1000" };
    expect(parseImportArgs(["--before", "2027-01-01"], env).maxDocuments).toBe(125);
    expect(
      parseImportArgs(["--before", "2027-01-01", "--max-documents", "9999"], env).maxDocuments,
    ).toBe(125);
    expect(
      parseImportArgs(["--before", "2027-01-01", "--max-documents", "10"], env).maxDocuments,
    ).toBe(10);
    expect(parseImportArgs(["--", "--before", "2027-01-01", "--dry-run"], env).dryRun).toBe(true);
  });

  it("requires the cutover day and refuses unknown options", () => {
    expect(() => parseImportArgs([], {})).toThrow("--before");
    expect(() => parseImportArgs(["--before", "2027-01-01", "--product", "bid"], {})).toThrow(
      "unknown",
    );
  });

  it("reads a backfill window, product and resume point", () => {
    const input = parseBackfillArgs([
      "--product",
      "shop",
      "--from",
      "2027-01-01",
      "--to",
      "2027-01-08T00:00:00Z",
      "--after",
      "42",
    ]);
    expect(input).toMatchObject({ product: "shop", afterId: 42, limit: 200, dryRun: false });
    expect(input.from.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(() => parseBackfillArgs(["--product", "xero", "--from", "a", "--to", "b"])).toThrow();
    expect(() =>
      parseBackfillArgs(["--product", "shop", "--from", "2027-01-01", "--to", "soon"]),
    ).toThrow("--to");
  });
});
