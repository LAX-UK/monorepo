import type { EditionFacts } from "@auction/shop-domain";

/** Reads and writes the facts confirmed about a run. */
export interface EditionFactsRepository {
  /** The facts, or null while none have been recorded for the artwork. */
  getFacts(artworkId: string): Promise<EditionFacts | null>;
  /** Replaces the facts. The database refuses combinations the rules forbid. */
  saveFacts(artworkId: string, facts: EditionFacts): Promise<void>;
}
