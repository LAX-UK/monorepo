import type {
  Consignor,
  ConsignorAgreement,
  ConsignorChangeRefusal,
  ConsignorLink,
} from "@auction/artwork-register-contracts";
import type { ShopTransactionEffects } from "./shop-unit-of-work.js";

/** What the Consignor field on a From Zoho record reads, outside any write. */
export type ArtworkConsignorReads = {
  /** Whether the register's artwork is an original or a print; null when it is not on the register. */
  artworkKind(registerId: string): Promise<"original" | "print" | null>;
  /** The artwork's consignor changes, newest first; the first is the consignor now. */
  listChanges(registerId: string, limit: number): Promise<ConsignorLink[]>;
  /** Client display names by party id; unknown ids are left out. */
  partyNames(partyIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  /** The client's agreements that are neither replaced nor retired. */
  currentAgreements(partyId: string): Promise<(ConsignorAgreement & { status: "current" })[]>;
};

export type SetArtworkConsignorResult =
  | { ok: true; changed: boolean; link: ConsignorLink; previous: ConsignorLink | null }
  | { ok: false; reason: "artwork_not_found" | "party_not_found" | ConsignorChangeRefusal }
  | { ok: false; reason: "stale"; current: ConsignorLink | null };

/**
 * The consignor store bound to one unit of work, so the new link, the LAX Admin audit row and
 * the idempotency record commit together or not at all.
 */
export type ArtworkConsignorWrites = {
  setConsignor(input: {
    registerId: string;
    consignor: Consignor;
    reason: string | null;
    expectedCurrentId?: string | null;
    actor: string;
    now: Date;
  }): Promise<SetArtworkConsignorResult>;
};

export type ArtworkConsignorWritesFor = (tx: ShopTransactionEffects) => ArtworkConsignorWrites;
