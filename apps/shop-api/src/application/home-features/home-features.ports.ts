import type { AdminHomeFeatureRow, AdminHomeFeatures } from "@auction/shop-contracts";
import type { HomeFeatureSlot, HomeFeatureTargetFacts } from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";
import type { StorefrontCurationWriter } from "../ports/storefront-curation.writer.js";

/** The featured lists as staff see them, each row with the facts behind its status line. */
export interface HomeFeatureListReader {
  list(): Promise<AdminHomeFeatures>;
  /** Records that could go in a slot, matching what staff typed; empty text lists the newest. */
  searchCandidates<S extends HomeFeatureSlot>(
    slot: S,
    query: { q?: string; limit: number },
  ): Promise<AdminHomeFeatureRow<S>[]>;
}

/** What a save looks up, inside its transaction. */
export interface HomeFeatureTargetReader {
  /** Holds the slot until the transaction ends, so two saves of one slot queue up. */
  lockSlot(slot: HomeFeatureSlot): Promise<void>;
  /** The slot's records as saved now, in order. */
  slotIds(slot: HomeFeatureSlot): Promise<string[]>;
  /** The facts for each id that names a record of the slot's kind; unknown ids are left out. */
  targetFacts(slot: HomeFeatureSlot, ids: readonly string[]): Promise<HomeFeatureTargetFacts[]>;
}

export type HomeFeaturesTx = {
  targets: HomeFeatureTargetReader;
  lists: HomeFeatureListReader;
  curation: StorefrontCurationWriter;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface HomeFeaturesUnitOfWork {
  run<T>(fn: (tx: HomeFeaturesTx) => Promise<T>): Promise<T>;
}
