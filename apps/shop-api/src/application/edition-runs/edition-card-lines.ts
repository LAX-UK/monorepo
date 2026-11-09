import { type EditionFacts, type EditionRunSpec, describeEditionFacts } from "@auction/shop-domain";

/** An edition run together with its stored facts. */
export type RunWithFacts = { artworkId: string; run: EditionRunSpec; facts: EditionFacts };

/** Reads the runs and facts of many artworks at once; originals and runs without facts are left out. */
export type EditionCardFactsReader = {
  runsWithFacts(artworkIds: readonly string[]): Promise<RunWithFacts[]>;
};

/**
 * The card line of each edition run whose facts staff have confirmed, keyed by artwork id. One read
 * for the whole page. The wording is shop-domain's; this only decides which runs may show it.
 */
export async function editionCardLines(
  reader: EditionCardFactsReader,
  artworkIds: readonly string[],
): Promise<Map<string, string>> {
  const lines = new Map<string, string>();
  if (artworkIds.length === 0) return lines;
  for (const { artworkId, run, facts } of await reader.runsWithFacts([...new Set(artworkIds)])) {
    // A print sold on its own reads as its run on a card: the card says what the run is.
    if (!facts.confirmed) continue;
    lines.set(artworkId, describeEditionFacts(run, facts).cardLine);
  }
  return lines;
}
