import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { artworkRegister as register } from "@auction/db/schema";
import { type SQL, and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type {
  DealArtworkSearchInput,
  IDealArtworkSearchReader,
} from "../../interfaces/deal-artwork-search.js";
import { containsPattern } from "../../lib/like-pattern.js";
import { toEntry } from "./artwork-register.mapper.js";

/** Matches the typed text in any of the places staff know an artwork by. */
function matchesText(text: string): SQL | undefined {
  const typed = text.trim();
  if (typed === "") return undefined;
  const pattern = containsPattern(typed);
  return or(
    ilike(register.title, pattern),
    ilike(register.artistName, pattern),
    ilike(register.stockCode, pattern),
  );
}

/** 0 when both the artist and the title match the enquiry, 1 when one does, 2 otherwise. */
function suggestionRank(suggest: DealArtworkSearchInput["suggest"]): SQL {
  const artist = suggest?.artist?.trim();
  const title = suggest?.title?.trim();
  const artistHit = artist
    ? sql`(${register.artistName} ILIKE ${containsPattern(artist)})`
    : sql`false`;
  const titleHit = title ? sql`(${register.title} ILIKE ${containsPattern(title)})` : sql`false`;
  return sql<number>`(CASE WHEN ${artistHit} AND ${titleHit} THEN 0 WHEN ${artistHit} OR ${titleHit} THEN 1 ELSE 2 END)`;
}

export class DrizzleDealArtworkSearchReader implements IDealArtworkSearchReader {
  constructor(private readonly db: Database) {}

  async searchOriginals(input: DealArtworkSearchInput): Promise<ArtworkRegisterEntry[]> {
    const rows = await this.db
      .select()
      .from(register)
      .where(and(eq(register.kind, "original"), matchesText(input.text)))
      .orderBy(suggestionRank(input.suggest), asc(register.title), asc(register.id))
      .limit(input.limit);
    return rows.map(toEntry);
  }
}
