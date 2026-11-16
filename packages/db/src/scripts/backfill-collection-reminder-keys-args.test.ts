import { describe, expect, it } from "vitest";
import { collectFlags } from "./backfill-cli-flags.js";
import { main, parseReminderBackfillArgs } from "./backfill-collection-reminder-keys.js";

describe("parseReminderBackfillArgs", () => {
  it("is a dry run unless --apply is explicit", () => {
    expect(parseReminderBackfillArgs([])).toEqual({ apply: false });
    expect(parseReminderBackfillArgs(["--apply"])).toEqual({ apply: true });
    expect(parseReminderBackfillArgs(["--", "--apply"])).toEqual({ apply: true });
  });

  it("rejects unknown flags and stray arguments instead of dry-running", () => {
    for (const arg of ["--aply", "apply", "--apply=1", "--dry-run", "--batch-size=5", "5"]) {
      expect(() => parseReminderBackfillArgs([arg]), arg).toThrow(/Unknown argument/);
    }
  });

  it("rejects a repeated --apply", () => {
    expect(() => parseReminderBackfillArgs(["--apply", "--apply"])).toThrow(/more than once/);
  });

  it("main rejects bad arguments before touching the database", async () => {
    await expect(main(["--aply"])).rejects.toThrow(/Unknown argument/);
  });
});

describe("collectFlags", () => {
  it("rejects repeated and empty value flags", () => {
    expect(() => collectFlags(["--n=1", "--n=2"], ["n"])).toThrow(/more than once/);
    expect(() => collectFlags(["--n="], ["n"])).toThrow(/needs a value/);
    expect(collectFlags(["--n=1"], ["n"]).values.get("n")).toBe("1");
  });
});
