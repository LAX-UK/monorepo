import type {
  AgreementChangeRefusal,
  AgreementTerms,
  ConsignmentPlace,
  Consignor,
  ConsignorAgreement,
  ConsignorChangeRefusal,
  ConsignorCover,
  ConsignorLink,
} from "@auction/artwork-register-contracts";

/**
 * Consignor agreements and the consignor of each original (register item ZI-5,
 * docs/design/decision-pack-2026-11-17.md section 1, option B). Data only: no route uses these yet.
 */
export interface IConsignorAgreementReader {
  /**
   * The client's agreements: current versions first, then retired ones, newest first. Replaced
   * versions are left out unless asked for.
   */
  listAgreements(
    partyId: string,
    options?: { includeReplaced?: boolean },
  ): Promise<ConsignorAgreement[]>;
  /** One version by its row id. */
  findAgreementVersion(id: string): Promise<ConsignorAgreement | null>;
  /** Every version of an agreement, oldest first. */
  listVersions(agreementId: string): Promise<ConsignorAgreement[]>;
  /** The consignor of each artwork that has one; artworks without one are left out. */
  currentConsignors(registerIds: readonly string[]): Promise<Map<string, ConsignorLink>>;
  /** The artwork's consignor changes, newest first. */
  listConsignorChanges(registerId: string, limit: number): Promise<ConsignorLink[]>;
  /**
   * What the consignor data says about offering the artwork at `place` on `day` (a London
   * calendar day): no consignor, LAX owns it, covered (with the agreement) or not covered.
   */
  assessCover(input: {
    registerId: string;
    place: ConsignmentPlace;
    day: string;
  }): Promise<ConsignorCover>;
}

/** Terms are already checked with `parseAgreementTerms`; the database repeats the rules. */
export type AddAgreementInput = {
  partyId: string;
  terms: AgreementTerms;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type AddAgreementResult =
  | { ok: true; agreement: ConsignorAgreement }
  /** No such client, or the party is LAX itself. */
  | { ok: false; reason: "party_not_found" };

export type ReplaceAgreementInput = {
  agreementId: string;
  /** The version staff were looking at. */
  expectedVersion: number;
  terms: AgreementTerms;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type RetireAgreementInput = {
  agreementId: string;
  expectedVersion: number;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type AgreementChangeResult =
  | { ok: true; agreement: ConsignorAgreement }
  | { ok: false; reason: AgreementChangeRefusal };

export type SetConsignorInput = {
  registerId: string;
  consignor: Consignor;
  /** Required for any change after the first; ignored when nothing changes. */
  reason: string | null;
  /**
   * The link the writer last read (null: none set). When given and the current link is another
   * one, nothing is written and the result is `stale`. Left out, any current link is replaced.
   */
  expectedCurrentId?: string | null;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type SetConsignorResult =
  /**
   * `changed` is false when the artwork already had this consignor: nothing written. `previous`
   * is the consignor before this change (null the first time).
   */
  | { ok: true; changed: boolean; link: ConsignorLink; previous: ConsignorLink | null }
  | {
      ok: false;
      reason: "artwork_not_found" | "party_not_found" | ConsignorChangeRefusal;
    }
  /** Someone changed the consignor after the writer read it; `current` is the change now. */
  | { ok: false; reason: "stale"; current: ConsignorLink | null };

/**
 * Agreement and consignor writes. An agreement is replaced by its next version in one transaction
 * (the old version marked replaced, the new one added), never edited in place; retiring marks the
 * current version retired. A consignor change adds a row; the latest row is the consignor now.
 */
export interface IConsignorAgreementWriter {
  addAgreement(input: AddAgreementInput): Promise<AddAgreementResult>;
  replaceAgreement(input: ReplaceAgreementInput): Promise<AgreementChangeResult>;
  retireAgreement(input: RetireAgreementInput): Promise<AgreementChangeResult>;
  setConsignor(input: SetConsignorInput): Promise<SetConsignorResult>;
}

export interface IConsignorAgreementStore
  extends IConsignorAgreementReader,
    IConsignorAgreementWriter {}
