import { type AgreementReminderDay, agreementTermsComplete } from "@auction/domain";
import type {
  AwaitingConsignmentAgreement,
  ConsignmentAgreementProposalRow,
  IConsignmentAgreementRepository,
} from "@auction/persistence/interfaces";
import type { ConsignmentAgreement } from "@auction/types";

type Stored = ConsignmentAgreement & {
  submissionTitle: string;
  reminderDay3SentAt: Date | null;
  reminderDay7SentAt: Date | null;
};

/**
 * Agreements kept in memory with the same conditional-write rules as the database adapter:
 * an acceptance is recorded once, and each reminder is marked once.
 */
export class InMemoryConsignmentAgreements implements IConsignmentAgreementRepository {
  readonly rows = new Map<string, Stored>();
  acceptWrites = 0;

  seed(
    agreement: Partial<Stored> & Pick<ConsignmentAgreement, "submissionId" | "legalEntityId">,
  ): Stored {
    const row: Stored = {
      id: `agr-${agreement.submissionId}`,
      termsVersion: "conditions-of-business-part-c-v1",
      estimateLow: "8000.00",
      estimateHigh: "12000.00",
      reservePrice: null,
      commissionPercent: "15.00",
      currency: "GBP",
      proposedAt: new Date("2026-10-01T09:00:00Z"),
      acceptedAt: null,
      acceptedByUserId: null,
      submissionTitle: "Untitled (Blue)",
      reminderDay3SentAt: null,
      reminderDay7SentAt: null,
      ...agreement,
    };
    this.rows.set(row.submissionId, row);
    return row;
  }

  private present(row: Stored): ConsignmentAgreement {
    const {
      submissionTitle: _t,
      reminderDay3SentAt: _3,
      reminderDay7SentAt: _7,
      ...agreement
    } = row;
    return { ...agreement };
  }

  async findBySubmissionId(submissionId: string) {
    const row = this.rows.get(submissionId);
    return row ? this.present(row) : null;
  }

  async listByLegalEntity(legalEntityId: string) {
    return [...this.rows.values()]
      .filter((row) => row.legalEntityId === legalEntityId)
      .map((row) => this.present(row));
  }

  async listBySubmissionIds(submissionIds: readonly string[]) {
    return submissionIds
      .map((id) => this.rows.get(id))
      .filter((row): row is Stored => row !== undefined)
      .map((row) => this.present(row));
  }

  async listAwaiting(proposedBefore: Date, limit: number): Promise<AwaitingConsignmentAgreement[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          !row.acceptedAt &&
          !row.reminderDay7SentAt &&
          agreementTermsComplete(row) &&
          row.proposedAt.getTime() <= proposedBefore.getTime(),
      )
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        submissionId: row.submissionId,
        legalEntityId: row.legalEntityId,
        submissionTitle: row.submissionTitle,
        proposedAt: row.proposedAt,
        acceptedAt: null,
        reminderDay3SentAt: row.reminderDay3SentAt,
        reminderDay7SentAt: row.reminderDay7SentAt,
      }));
  }

  async propose(row: ConsignmentAgreementProposalRow) {
    const existing = this.rows.get(row.submissionId);
    if (existing?.acceptedAt) return this.present(existing);
    const { proposedByUserId: _by, ...rest } = row;
    return this.present(this.seed({ ...rest }));
  }

  async accept(input: { submissionId: string; acceptedByUserId: string; acceptedAt: Date }) {
    const row = this.rows.get(input.submissionId);
    if (!row) return null;
    if (!row.acceptedAt) {
      this.acceptWrites += 1;
      row.acceptedAt = input.acceptedAt;
      row.acceptedByUserId = input.acceptedByUserId;
    }
    return this.present(row);
  }

  async markReminderSent(id: string, day: AgreementReminderDay, sentAt: Date) {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (!row || row.acceptedAt) return false;
    if (day === 3) {
      if (row.reminderDay3SentAt) return false;
      row.reminderDay3SentAt = sentAt;
      return true;
    }
    if (row.reminderDay7SentAt) return false;
    row.reminderDay7SentAt = sentAt;
    row.reminderDay3SentAt ??= sentAt;
    return true;
  }

  async setRelistReserveFloor(submissionId: string, floor: string | null, _at: Date) {
    const row = this.rows.get(submissionId);
    if (!row) return null;
    row.relistReserveFloor = floor;
    return this.present(row);
  }
}
