import type {
  IUnsoldLotChoiceRepository,
  OpenUnsoldLotChoice,
  UnsoldLotChoiceDecisionRow,
  UnsoldLotChoiceRequestRow,
  UnsoldLotOutcomeKey,
  UnsoldOutcomeListFilter,
  UnsoldOutcomeRow,
} from "@auction/persistence/interfaces";
import type { UnsoldLotChoice } from "@auction/types";

const keyOf = (key: UnsoldLotOutcomeKey) => `${key.lotId}@${key.lotEndTime.toISOString()}`;

/**
 * Unsold-lot choices in memory with the database adapter's rules: one choice per unsold
 * outcome, and a confirmed choice is never overwritten.
 */
export class InMemoryUnsoldLotChoices implements IUnsoldLotChoiceRepository {
  readonly rows = new Map<string, UnsoldLotChoice>();
  /** Consigned lots that ended unsold, with the account and sender of their submission. */
  readonly outcomes: (UnsoldOutcomeRow & {
    legalEntityId: string;
    submittedByUserId: string | null;
  })[] = [];
  writes = 0;
  private seq = 0;

  private blank(row: UnsoldLotChoiceRequestRow | UnsoldLotChoiceDecisionRow): UnsoldLotChoice {
    this.seq += 1;
    const at = "requestedAt" in row ? row.requestedAt : row.decidedAt;
    return {
      id: `choice-${this.seq}`,
      lotId: row.lotId,
      lotEndTime: row.lotEndTime,
      submissionId: row.submissionId,
      legalEntityId: row.legalEntityId,
      status: "requested",
      requestedChoice: null,
      requestedReserve: null,
      requestedByUserId: null,
      requestedAt: null,
      decidedChoice: null,
      decidedReserve: null,
      decidedByUserId: null,
      decidedAt: null,
      staffNote: null,
      currency: row.currency,
      createdAt: at,
      updatedAt: at,
    };
  }

  async findForOutcome(key: UnsoldLotOutcomeKey) {
    return this.rows.get(keyOf(key)) ?? null;
  }

  async listOpenRequests(limit: number): Promise<OpenUnsoldLotChoice[]> {
    return [...this.rows.values()]
      .filter((row) => row.status === "requested")
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        lotId: row.lotId,
        submissionId: row.submissionId,
        lotTitle: "Lot",
        requestedChoice: row.requestedChoice,
        requestedAt: row.requestedAt,
      }));
  }

  async listUnsoldOutcomes(filter: UnsoldOutcomeListFilter) {
    const visible = (submittedByUserId: string | null) => {
      const scope = filter.visibleTo?.scope ?? "all";
      if (scope === "all") return true;
      if (scope === "own") return submittedByUserId === filter.visibleTo?.userId;
      return submittedByUserId !== null;
    };
    const matching = this.outcomes
      .filter((row) => row.legalEntityId === filter.legalEntityId && visible(row.submittedByUserId))
      .filter((row) =>
        filter.choice === undefined ? true : (row.choice ?? "none") === filter.choice,
      )
      .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
    return {
      rows: matching
        .slice(filter.offset, filter.offset + filter.limit)
        .map(({ lotId, submissionId, title, endedAt, choice }) => ({
          lotId,
          submissionId,
          title,
          chooseBy: null,
          endedAt,
          choice,
        })),
      total: matching.length,
    };
  }

  async countOpenRequests() {
    return [...this.rows.values()].filter((row) => row.status === "requested").length;
  }

  async saveRequest(row: UnsoldLotChoiceRequestRow) {
    const existing = this.rows.get(keyOf(row));
    if (existing?.status === "confirmed") return null;
    this.writes += 1;
    const stored: UnsoldLotChoice = {
      ...(existing ?? this.blank(row)),
      requestedChoice: row.choice,
      requestedReserve: row.reserve,
      requestedByUserId: row.requestedByUserId,
      requestedAt: row.requestedAt,
      updatedAt: row.requestedAt,
    };
    this.rows.set(keyOf(row), stored);
    return stored;
  }

  async saveDecision(row: UnsoldLotChoiceDecisionRow) {
    const existing = this.rows.get(keyOf(row));
    if (existing?.status === "confirmed") return null;
    this.writes += 1;
    const stored: UnsoldLotChoice = {
      ...(existing ?? this.blank(row)),
      status: "confirmed",
      decidedChoice: row.choice,
      decidedReserve: row.reserve,
      decidedByUserId: row.decidedByUserId,
      decidedAt: row.decidedAt,
      staffNote: row.note,
      updatedAt: row.decidedAt,
    };
    this.rows.set(keyOf(row), stored);
    return stored;
  }
}
