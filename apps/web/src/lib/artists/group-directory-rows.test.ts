import type { PublicArtistDirectoryRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import { groupDirectoryRows } from "./group-directory-rows";

const row = (id: string, kind: PublicArtistDirectoryRow["kind"]) =>
  ({ id, kind }) as PublicArtistDirectoryRow;

describe("groupDirectoryRows", () => {
  it("splits people from makers and brands, keeping order", () => {
    const groups = groupDirectoryRows([
      row("a", "artist"),
      row("f", "marque"),
      row("b", "author"),
      row("m", "mint"),
    ]);
    expect(groups.map((g) => [g.heading, g.rows.map((r) => r.id)])).toEqual([
      ["Artists", ["a", "b"]],
      ["Makers and brands", ["f", "m"]],
    ]);
  });

  it("leaves a list of one sort whole and without a heading", () => {
    const groups = groupDirectoryRows([row("a", "artist"), row("b", "designer")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.heading).toBeNull();
    expect(groups[0]?.rows).toHaveLength(2);
  });

  it("returns no groups for no rows", () => {
    expect(groupDirectoryRows([])).toEqual([]);
  });
});
