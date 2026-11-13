import type { CoverImageAnalyser } from "@auction/image-processing";
import type { AdminHomeCoverPictureCandidate } from "@auction/shop-contracts";
import type { CoverAnalysis, UnitPoint } from "@auction/types";
import type { ImageProbePort } from "../ports/image-probe.port.js";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";

/** The cover picture as saved, with what was measured from it. */
export type StoredHomeCover = {
  mediaKey: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  focal: UnitPoint;
  alt: string;
  analysis: CoverAnalysis;
  /** ISO time, so a replayed save returns exactly what the first one did. */
  updatedAt: string;
};

/** What a save writes: the stored picture without its save time, which the store sets. */
export type HomeCoverRecord = Omit<StoredHomeCover, "updatedAt">;

export interface HomeCoverReader {
  read(): Promise<StoredHomeCover | null>;
}

/** What a save reads and writes, inside its transaction. */
export interface HomeCoverStore extends HomeCoverReader {
  /** Holds the setting until the transaction ends, so two saves queue up. */
  lock(): Promise<void>;
  save(record: HomeCoverRecord, actorSubjectId: string, at: Date): Promise<void>;
  clear(): Promise<void>;
}

export type HomeCoverTx = {
  store: HomeCoverStore;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface HomeCoverUnitOfWork {
  run<T>(fn: (tx: HomeCoverTx) => Promise<T>): Promise<T>;
}

/**
 * The pictures a cover may be made from: those already on the Shop's media (uploaded in LAX Admin
 * or on a Shop edition). Any other key reads as unknown, so a cover can never publish a file that
 * was not put there for the public.
 */
export interface HomeCoverPictures {
  /** The picture's bytes, or null when the key is not a Shop picture or is missing. */
  load(mediaKey: string): Promise<Buffer | null>;
  /** Pictures of live Shop editions matching what staff typed; empty text lists the newest. */
  search(query: { q?: string; limit: number }): Promise<AdminHomeCoverPictureCandidate[]>;
}

export type HomeCoverMeasuring = {
  analyser: CoverImageAnalyser;
  probe: Pick<ImageProbePort, "analyze">;
};
