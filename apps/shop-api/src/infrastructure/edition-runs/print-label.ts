import { shopArtwork, shopEdition } from "@auction/db/schema";
import { LAX_STANDARD_RUN, type ProofsKept, printLabel } from "@auction/shop-domain";
import { type RunColumns, runFromColumns } from "../edition-run-columns.js";

/**
 * What a list query selects to name a print: the print's own numbers and the columns of the
 * artwork that describe its run. Spread it under one key and pass that key to `printLabelOf`.
 */
export const printLabelSelection = {
  editionNumber: shopEdition.editionNumber,
  stockRef: shopEdition.stockRef,
  proofNumber: shopEdition.proofNumber,
  artworkId: shopArtwork.id,
  sourceOriginalArtworkId: shopArtwork.sourceOriginalArtworkId,
  runKind: shopArtwork.runKind,
  runRole: shopArtwork.runRole,
  runTemplate: shopArtwork.runTemplate,
  runSize: shopArtwork.runSize,
  allocBuyer: shopArtwork.allocBuyer,
  allocArtist: shopArtwork.allocArtist,
  allocLax: shopArtwork.allocLax,
  openDefaultArtistPct: shopArtwork.openDefaultArtistPct,
  mainRunArtworkId: shopArtwork.mainRunArtworkId,
  proofType: shopArtwork.proofType,
  proofsKeptAp: shopArtwork.proofsKeptAp,
  proofsKeptPp: shopArtwork.proofsKeptPp,
  proofsKeptHc: shopArtwork.proofsKeptHc,
  proofsKeptBat: shopArtwork.proofsKeptBat,
};

export type PrintLabelRow = Pick<
  typeof shopEdition.$inferSelect,
  "editionNumber" | "stockRef" | "proofNumber"
> &
  RunColumns & { artworkId: string; sourceOriginalArtworkId: string | null };

// A label never reads the proofs a main run kept, only the proof's type and size.
const NO_PROOFS_KEPT: ProofsKept = { ap: 0, pp: 0, hc: 0, bat: 0 };

/**
 * "7/24", "AP 2/3" or "OE-0021": the name of a print in a list, from the shared label rule. A
 * listing with no stored run is a LAX standard run, as every print was before runs were stored.
 */
export function printLabelOf(row: PrintLabelRow): string {
  const run = runFromColumns({ ...row, id: row.artworkId }, NO_PROOFS_KEPT);
  return printLabel(
    { editionNumber: row.editionNumber, proofNumber: row.proofNumber, stockRef: row.stockRef },
    run?.spec ?? LAX_STANDARD_RUN,
  );
}
