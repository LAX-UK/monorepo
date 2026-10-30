import type {
  LotStatus,
  UnsoldLotChoice,
  UnsoldLotChoiceKind,
  UnsoldLotChoiceStatus,
} from "@auction/types";
import type { SubmissionSenderFilter } from "./item-submission.repository.js";

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

/** Which of an account's unsold outcomes to read, newest first. */
export type UnsoldOutcomeListFilter = {
  legalEntityId: string;
  /** Lot statuses that end a sale; with no winner, the lot did not sell (from the domain). */
  endedStatuses: readonly LotStatus[];
  /** Which senders' consignments the member may see; absent for every one. */
  visibleTo?: SubmissionSenderFilter | undefined;
  /** Only outcomes in this state; `none` means nobody has chosen yet. */
  choice?: UnsoldLotChoiceStatus | "none" | undefined;
  limit: number;
  offset: number;
};

/** A consigned lot that ended without selling, with what has been chosen for it. */
export type UnsoldOutcomeRow = {
  lotId: string;
  submissionId: string;
  title: string;
  endedAt: Date;
  /** The stored date the choice is due by; `null` until the outcome is first shown. */
  chooseBy: Date | null;
  /** `null` while nobody has chosen. */
  choice: UnsoldLotChoiceStatus | null;
};

export interface IUnsoldLotChoiceReader {
  findForOutcome(key: UnsoldLotOutcomeKey): Promise<UnsoldLotChoice | null>;
  /** An account's consigned lots that ended unsold in their latest sale, one page at a time. */
  listUnsoldOutcomes(
    filter: UnsoldOutcomeListFilter,
  ): Promise<{ rows: UnsoldOutcomeRow[]; total: number }>;
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

/** An unsold outcome with the date its choice is due by. */
export type UnsoldChoiceDeadline = UnsoldLotOutcomeKey & { chooseBy: Date };

/**
 * The stored unsold-choice dates. A date is kept the first time its outcome is shown and never
 * moved by a later change to the window, so `keep` stores only the outcomes that have none yet.
 */
export interface IUnsoldChoiceDeadlineStore {
  /** Stores each proposed date unless one is already kept; returns the kept dates. */
  keep(proposed: readonly UnsoldChoiceDeadline[]): Promise<UnsoldChoiceDeadline[]>;
  /** The stored dates for these outcomes; an outcome with none is left out. Reads only. */
  kept(outcomes: readonly UnsoldLotOutcomeKey[]): Promise<UnsoldChoiceDeadline[]>;
  /**
   * The lot's current unsold outcome when it is a consigned lot that ended without selling;
   * `null` otherwise (sold, still running, or not a consignment).
   */
  unsoldOutcomeOf(lotId: string): Promise<UnsoldLotOutcomeKey | null>;
}
