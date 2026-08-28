import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

const drizzle = resolve(import.meta.dirname, "../drizzle");
const journal = JSON.parse(readFileSync(resolve(drizzle, "meta/_journal.json"), "utf8")) as {
  entries: JournalEntry[];
};

describe("migration history contract", () => {
  it("keeps journal indices and timestamps unique and strictly increasing", () => {
    const indices = journal.entries.map(({ idx }) => idx);
    const timestamps = journal.entries.map(({ when }) => when);

    expect(new Set(indices).size).toBe(indices.length);
    expect(new Set(timestamps).size).toBe(timestamps.length);
    for (let index = 1; index < journal.entries.length; index += 1) {
      const previous = journal.entries[index - 1];
      const current = journal.entries[index];
      expect(current?.when).toBeGreaterThan(previous?.when ?? 0);
    }
  });

  it("preserves the buyer-interest lineage already released on main", () => {
    expect(journal.entries.slice(136, 139)).toEqual([
      {
        idx: 136,
        version: "7",
        when: 1788000013000,
        tag: "0137_user_category_interests",
        breakpoints: true,
      },
      {
        idx: 137,
        version: "7",
        when: 1788000014000,
        tag: "0138_buyer_interest_categories",
        breakpoints: true,
      },
      {
        idx: 138,
        version: "7",
        when: 1788000015000,
        tag: "0139_complete_buyer_interest_categories",
        breakpoints: true,
      },
    ]);
    expect(journal.entries[139]?.tag).toBe("0140_identity_boundary_profiles");
    expect(journal.entries.at(-1)?.tag).toBe("0161_revoke_api_user_reads");
  });

  it("keeps every registered migration and rollback pair on disk", async () => {
    for (const { tag } of journal.entries.slice(136)) {
      const version = tag.slice(0, 4);
      await expect(access(resolve(drizzle, `${tag}.sql`))).resolves.toBeUndefined();
      await expect(access(resolve(drizzle, `${version}_rollback.sql`))).resolves.toBeUndefined();
    }
  });
});
