import type { UnsoldLotChoice, UnsoldLotChoiceKind } from "@auction/types";

/** One unsold outcome of a lot: the lot and the end time of the sale it did not sell in. */
export type UnsoldLotOutcomeKey = { lotId: string; lotEndTime: Date };

type UnsoldLotChoiceOwner = UnsoldLotOutcomeKey & {
  submissionId: string;
  legalEntityId: string;
  currency: string;
};

export type UnsoldLotChoiceRequestRow = UnsoldLotChoiceOwner & {
  choice: UnsoldLotChoiceKind;
  reserve: string | null;
  requestedByUserId: string;
  requestedAt: Date;
};

export type UnsoldLotChoiceDecisionRow = UnsoldLotChoiceOwner & {
  choice: UnsoldLotChoiceKind;
  reserve: string | null;
  note: string | null;
  decidedByUserId: string;
  decidedAt: Date;
};

/** A seller's request still waiting for a specialist, for the staff work queue. */
export type OpenUnsoldLotChoice = {
  id: string;
  lotId: string;
  submissionId: string;
  lotTitle: string;
  requestedChoice: UnsoldLotChoiceKind | null;
  requestedAt: Date | null;
};

export interface IUnsoldLotChoiceReader {
  findForOutcome(key: UnsoldLotOutcomeKey): Promise<UnsoldLotChoice | null>;
  listOpenRequests(limit: number): Promise<OpenUnsoldLotChoice[]>;
  countOpenRequests(): Promise<number>;
}

/** Each write is conditional on the choice not being confirmed, so a retry never overwrites one. */
export interface IUnsoldLotChoiceWriter {
  /** Records or changes the seller's request. `null` when a specialist confirmed meanwhile. */
  saveRequest(row: UnsoldLotChoiceRequestRow): Promise<UnsoldLotChoice | null>;
  /** Confirms the outcome, with or without a request. `null` when it was already confirmed. */
  saveDecision(row: UnsoldLotChoiceDecisionRow): Promise<UnsoldLotChoice | null>;
}

export type IUnsoldLotChoiceRepository = IUnsoldLotChoiceReader & IUnsoldLotChoiceWriter;
