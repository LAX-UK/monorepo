import { describeFeeMismatch, feeMismatchSegment } from "./atg-fee-check.js";
import { type AtgGateway, AtgGatewayError } from "./atg-gateway.js";
import type { GapAuctionFields } from "./gap-types.js";

export type AtgFeeVerifierDeps = {
  gateway: Pick<AtgGateway, "getAuction">;
  /** Called once per distinct message for a sale, not every time the same mismatch is seen. */
  onMismatch?: (saleId: string, message: string) => void;
};

export type FeeVerification = {
  saleId: string;
  auctionId: string;
  /** The fields LAX holds for the auction (what ATG should hold too). */
  fields: GapAuctionFields;
  /** True right after LAX wrote them to ATG. */
  justSent: boolean;
  /** The link's `lastError` before this check. */
  priorError: string | null;
};

/**
 * Reads an auction back from ATG and compares the fees it holds with LAX's. It reads when the
 * fields were just sent, while a mismatch is showing (so it clears only when ATG agrees), and
 * once per sale per process, which checks auctions pushed before this ran. Never throws for an
 * ATG failure: a failed read leaves what is shown as it was.
 */
export class AtgFeeVerifier {
  private readonly verified = new Set<string>();

  constructor(private readonly deps: AtgFeeVerifierDeps) {}

  hasVerified(saleId: string): boolean {
    return this.verified.has(saleId);
  }

  /** The mismatch message to show now (null when the fees agree). */
  async verify(input: FeeVerification): Promise<string | null> {
    const showing = feeMismatchSegment(input.priorError);
    const due = input.justSent || showing !== null || !this.verified.has(input.saleId);
    if (!due) return null;
    let message: string | null;
    try {
      const remote = await this.deps.gateway.getAuction(input.auctionId);
      message = remote ? describeFeeMismatch(input.fields, remote.fees) : null;
    } catch (err) {
      if (!(err instanceof AtgGatewayError)) throw err;
      return showing;
    }
    this.verified.add(input.saleId);
    if (message && message !== showing) this.deps.onMismatch?.(input.saleId, message);
    return message;
  }
}
