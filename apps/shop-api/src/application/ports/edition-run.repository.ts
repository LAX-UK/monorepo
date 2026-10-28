import type { EditionRunSpec, ProofsKept } from "@auction/shop-domain";

/** A run and the proofs its artist kept outside it. */
export type EditionRunConfig = { spec: EditionRunSpec; proofsKept: ProofsKept };

export type StoredEditionRun = EditionRunConfig & { artworkId: string };

export type StockBatchCustody = "unprinted" | "stored";

/** One addition of unnumbered prints to an open edition. */
export type EditionStockBatch = {
  id: string;
  artworkId: string;
  firstStockRef: number;
  quantity: number;
  artistCount: number;
  laxCount: number;
  custodyStatus: StockBatchCustody;
  storageLocation: string | null;
  addedBySubjectId: string;
  createdAt: Date;
};

export type AddStockBatchCommand = {
  artworkId: string;
  artistCount: number;
  laxCount: number;
  custodyStatus: StockBatchCustody;
  storageLocation?: string | null;
  addedBySubjectId: string;
};

/** Reads and writes the run an artwork sells, and the batches that stock an open edition. */
export interface EditionRunRepository {
  /** The run, or null for an original. */
  getRun(artworkId: string): Promise<StoredEditionRun | null>;
  /** Records the run. Does not create or change prints. */
  saveRun(artworkId: string, config: EditionRunConfig): Promise<void>;
  listStockBatches(artworkId: string): Promise<EditionStockBatch[]>;
  /** Adds unnumbered prints to an open edition, owned by the artist and LAX as the batch says. */
  addStockBatch(command: AddStockBatchCommand): Promise<EditionStockBatch>;
}
