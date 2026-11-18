import { describe, expect, it } from "vitest";
import { parseZohoCatchUpArgs, zohoCatchUpMode } from "./zoho-catch-up-after-live.args.js";

describe("parseZohoCatchUpArgs", () => {
  it("applies by default", () => {
    expect(parseZohoCatchUpArgs(["--consumer", "zoho_fulfilment"])).toEqual({
      consumer: "zoho_fulfilment",
      apply: true,
    });
  });

  it("previews with --dry-run and takes a limit", () => {
    expect(
      parseZohoCatchUpArgs([
        "--",
        "--consumer",
        "zoho_artwork_listing",
        "--dry-run",
        "--limit",
        "200",
      ]),
    ).toEqual({ consumer: "zoho_artwork_listing", apply: false, limit: 200 });
  });

  it.each([
    [[]],
    [["--consumer", "zoho"]],
    [["--consumer"]],
    [["--consumer", "zoho_fulfilment", "--limit", "0"]],
    [["--consumer", "zoho_fulfilment", "--limit", "ten"]],
    [["--consumer", "zoho_fulfilment", "--apply"]],
  ])("refuses %j", (argv) => {
    expect(() => parseZohoCatchUpArgs(argv)).toThrow();
  });
});

describe("zohoCatchUpMode", () => {
  it("reads the consumer's own mode variable", () => {
    const env = {
      ZOHO_ARTWORK_WRITEBACK_MODE: "live",
      ZOHO_ARTWORK_LISTING_MODE: "dry_run",
    };
    expect(zohoCatchUpMode("zoho_artwork_writeback", env)).toBe("live");
    expect(zohoCatchUpMode("zoho_artwork_listing", env)).toBe("dry_run");
  });

  it("is off when unset, as the worker reads it", () => {
    expect(zohoCatchUpMode("zoho_fulfilment", {})).toBe("off");
  });

  it("refuses an unknown mode", () => {
    expect(() =>
      zohoCatchUpMode("zoho_fulfilment", { ZOHO_FULFILMENT_MIRROR_MODE: "canary" }),
    ).toThrow(/ZOHO_FULFILMENT_MIRROR_MODE/);
  });
});
