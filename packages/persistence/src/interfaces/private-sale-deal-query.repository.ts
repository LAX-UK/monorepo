import type { Database } from "@auction/db";
import type { DealScope, DealView, SettlementFollowUpSeverity } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";

/** One deal as a list row: enough to find it and see what it waits for. */
export type PrivateSaleDealListRow = {
  id: string;
  reference: string;
  stage: PrivateSaleDealStage;
  itemSubmissionId: string;
  /** The work's title and its consignment reference (C-1042). */
  workTitle: string;
  workReference: string;
  sellerName: string;
  buyerName: string | null;
  priceMinor: number | null;
  ownerUserId: string | null;
  offerExpiresAt: Date | null;
  paymentDueAt: Date | null;
  collectionDueAt: Date | null;
  updatedAt: Date;
  /** Set on a settled deal whose artwork the register does not show as sold through it. */
  settlementFollowUp: SettlementFollowUpSeverity | null;
};

/** A settled deal the register has not been told is sold, for the people who must act on it. */
export type SettlementFollowUpRow = {
  dealId: string;
  reference: string;
  ownerUserId: string | null;
  severity: SettlementFollowUpSeverity;
  /** When the deal last changed: the settlement, or the last staff change since. */
  updatedAt: Date;
};

/** How many settled deals need attention, and how many of those may have been sold twice. */
export type SettlementFollowUpCount = { total: number; urgent: number };

export type PrivateSaleDealListFilter = {
  view: DealView;
  viewerUserId: string;
  /** The deals the viewer may see at all. */
  scope: DealScope;
  /** Continue after this row, in the view's order. */
  after?: { updatedAt: Date; id: string } | null | undefined;
  limit: number;
};

/** How many deals sit in each stage, and how many of those the viewer owns. */
export type PrivateSaleDealStageCount = {
  stage: PrivateSaleDealStage;
  total: number;
  ownedByViewer: number;
};

/** The deal lists staff work from, and the deals a client acts in. Reads only. */
export interface IPrivateSaleDealQueryReader {
  /** One page of a view. Returns up to `limit + 1` rows so the caller can tell whether more follow. */
  list(filter: PrivateSaleDealListFilter): Promise<PrivateSaleDealListRow[]>;
  countByStage(viewerUserId: string, scope: DealScope): Promise<PrivateSaleDealStageCount[]>;
  /**
   * Settled deals in the scope whose artwork the register does not show as sold through them,
   * longest waiting first. Derived from the deal and the register on every read, never stored.
   */
  listSettlementFollowUps(
    scope: DealScope,
    limit: number,
    /** Leave out deals staff were already told about at their current severity. */
    options?: { unraisedOnly?: boolean },
  ): Promise<SettlementFollowUpRow[]>;
  /** The same deals counted in one aggregate, with no cap. */
  countSettlementFollowUps(scope: DealScope): Promise<SettlementFollowUpCount>;
  /**
   * The reference of the deal a work is in (PS-0012), or `null`. Only a cancelled deal frees the
   * work: a settled one has sold it.
   */
  findLiveDealReferenceForWork(itemSubmissionId: string): Promise<string | null>;
  /** The references (PS-0012) of the deals with these ids, for links to them. */
  findReferencesByIds(ids: readonly string[]): Promise<Map<string, string>>;
  /** Deals a person is named to act in, most recently changed first. */
  listIdsForActingUser(userId: string, limit: number): Promise<string[]>;
  /** The title and consignment reference of a work, for a deal's record. */
  findWorkSummary(
    itemSubmissionId: string,
  ): Promise<{ title: string; reference: string; legalEntityId: string } | null>;
}

/** The work a deal sells: an item submission. */
export type DealWork = {
  id: string;
  /** C-1042. */
  reference: string;
  legalEntityId: string;
  /** The member who sent the work in, who acts for the seller on the deal. */
  submittedByUserId: string | null;
  title: string;
  /** The consignment's state. Only an approved work can be sold privately. */
  status: string;
  /** The lot the work became, once it has one. */
  convertedLotId: string | null;
};

export type NewDealWork = {
  legalEntityId: string;
  title: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  submittedByUserId: string | null;
};

/** The works private sale deals are made of. */
export interface IDealWorkStore {
  /** Opens a draft consignment for the work inside the caller's transaction. */
  createDraftInTransaction(tx: Database, input: NewDealWork): Promise<DealWork>;
  /**
   * Reads a work and holds its row until the transaction ends, so a lot cannot be made from it
   * while a deal for it is being opened. `null` when there is none.
   */
  lockInTransaction(tx: Database, id: string): Promise<DealWork | null>;
  /** A work by its consignment reference (C-1042); `null` when there is none. */
  findByReference(reference: string): Promise<DealWork | null>;
}
