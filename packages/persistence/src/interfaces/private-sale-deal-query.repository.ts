import type { Database } from "@auction/db";
import type { DealView } from "@auction/domain";
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
};

export type PrivateSaleDealListFilter = {
  view: DealView;
  viewerUserId: string;
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
  countByStage(viewerUserId: string): Promise<PrivateSaleDealStageCount[]>;
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
  /** A work by its consignment reference (C-1042); `null` when there is none. */
  findByReference(reference: string): Promise<DealWork | null>;
}
