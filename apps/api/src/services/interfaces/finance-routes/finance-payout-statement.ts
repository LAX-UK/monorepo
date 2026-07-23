export type PayoutStatementOutcome =
  | { kind: "not_found" }
  | { kind: "forbidden"; error: string }
  | { kind: "generation_failed"; detail: string }
  | { kind: "redirect"; url: string }
  | { kind: "pending" };

export interface IPayoutStatementApplicationService {
  resolveForAdmin(payoutId: string): Promise<PayoutStatementOutcome>;
  resolveForLegalEntityMember(input: {
    userId: string;
    legalEntityId: string;
    payoutId: string;
  }): Promise<PayoutStatementOutcome>;
}
