import type { ILegalEntityRepository, IPayoutRepository } from "@auction/persistence/interfaces";
import type { Queue } from "bullmq";
import type {
  IPayoutStatementApplicationService,
  PayoutStatementOutcome,
} from "../interfaces/finance-routes/finance-payout-statement.js";
import { ensureStatementQueued } from "../payout/payout-statement-queue.js";

const STATEMENT_ROLES = new Set(["owner", "admin", "finance"]);

export class PayoutStatementApplicationService implements IPayoutStatementApplicationService {
  constructor(
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly payoutRepository: IPayoutRepository,
    private readonly payoutStatementQueue: Queue<{ payoutId: string }>,
  ) {}

  resolveForAdmin(payoutId: string): Promise<PayoutStatementOutcome> {
    return this.resolveByPayoutId(payoutId, null);
  }

  async resolveForLegalEntityMember(input: {
    userId: string;
    legalEntityId: string;
    payoutId: string;
  }): Promise<PayoutStatementOutcome> {
    const membership = await this.legalEntityRepository.findActiveMembership(
      input.userId,
      input.legalEntityId,
    );
    if (!membership) {
      return { kind: "forbidden", error: "not_a_member_of_legal_entity" };
    }
    if (!STATEMENT_ROLES.has(membership.role)) {
      return { kind: "forbidden", error: "insufficient_role_for_statement" };
    }
    return this.resolveByPayoutId(input.payoutId, input.legalEntityId);
  }

  private async resolveByPayoutId(
    payoutId: string,
    legalEntityId: string | null,
  ): Promise<PayoutStatementOutcome> {
    const p = await this.payoutRepository.findById(payoutId);
    if (!p) {
      return { kind: "not_found" };
    }
    if (legalEntityId !== null && p.legalEntityId !== legalEntityId) {
      return { kind: "not_found" };
    }
    if (p.statementGenerationError) {
      return {
        kind: "generation_failed",
        detail: p.statementGenerationError,
      };
    }
    if (p.statementUrl) {
      return { kind: "redirect", url: p.statementUrl };
    }
    await ensureStatementQueued(this.payoutRepository, this.payoutStatementQueue, payoutId);
    return { kind: "pending" };
  }
}
