import { artistProfile } from "@auction/db/schema";
import { type SQL, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { fuzzyScoreSql, matchedAliasSql } from "./artist-registry-search.js";

const db = drizzle.mock();

/** A one-table select prints the select-list columns bare, which a subquery would read as its own. */
function selectListOf(fragment: SQL) {
  return db
    .select({ value: fragment })
    .from(artistProfile)
    .where(eq(artistProfile.id, "any"))
    .toSQL().sql;
}

describe("artist search subqueries", () => {
  it("find the alias of the artist in the row, not an alias that shares the row's id", () => {
    expect(selectListOf(matchedAliasSql("%mon%"))).toContain(
      '"artist_profile_id" = "artist_profile"."id"',
    );
  });

  it("score the artist's own aliases", () => {
    expect(selectListOf(fuzzyScoreSql("monet"))).toContain(
      '"artist_profile_id" = "artist_profile"."id"',
    );
  });
});
