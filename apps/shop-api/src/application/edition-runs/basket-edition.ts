import {
  type EditionFacts,
  type EditionRunSpec,
  type SetApartDescribed,
  describeEditionFacts,
  describeEditionRun,
  runSize,
} from "@auction/shop-domain";

/** An edition run with its facts, if any are stored. */
export type RunOfArtwork = {
  artworkId: string;
  run: EditionRunSpec;
  facts: EditionFacts | null;
  /** Set for a print sold on its own: `run` and `facts` are then those of the run it came from. */
  setApart?: SetApartDescribed;
};

/** Reads the runs of many artworks at once; originals are left out. */
export type EditionRunsReader = {
  runsOf(artworkIds: readonly string[]): Promise<RunOfArtwork[]>;
};

/** What the basket and checkout say about a print line. */
export type BasketEdition = {
  /** The run's size; null for an open edition and for a proof. */
  size: number | null;
  /** "Limited edition of 24 · Hand-signed · Numbered": the contract's wording for the run. */
  line: string;
};

/**
 * The size and wording of each print's run. Wording comes from the shared edition contract: the
 * line with the facts staff confirmed, and only the run itself before they have. The size is
 * the run's, never a count of the print rows.
 */
export async function basketEditions(
  reader: EditionRunsReader,
  artworkIds: readonly string[],
): Promise<Map<string, BasketEdition>> {
  const editions = new Map<string, BasketEdition>();
  if (artworkIds.length === 0) return editions;
  for (const { artworkId, run, facts, setApart } of await reader.runsOf([...new Set(artworkIds)])) {
    editions.set(artworkId, {
      size: run.type === "proof" ? null : runSize(run),
      line: facts?.confirmed
        ? describeEditionFacts(run, facts, setApart ? { setApart } : {}).basketLine
        : describeEditionRun(run).edition,
    });
  }
  return editions;
}
