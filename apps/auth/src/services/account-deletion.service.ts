import {
  type AccountDeletionOutcome,
  type AccountDeletionProduct,
  type AccountDeletionStatus,
  DELETION_ELIGIBILITY_PRODUCTS,
  accountDeletionVerdict,
} from "@auction/identity-contracts";
import type { ReauthRequired } from "./account-contact.service.js";
import type { ProductDeletionEligibilityProbe } from "./account-deletion.ports.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountDeletionPorts = {
  operations: Pick<
    IdentityOperationsService,
    "readSecurityStatus" | "markDeletionRequested" | "cancelDeletionRequested" | "listSessions"
  >;
  products: ProductDeletionEligibilityProbe;
  /** Called with the product and the cause when one cannot be asked; deletion is then blocked. */
  onProductUnavailable?: (product: string, error: unknown) => void;
};

/**
 * Deleting an account, decided in one place for every caller.
 *
 * Identity asks each product what the person still has in flight there, in parallel, and
 * starts the deletion grace period only when every product answers "nothing". A product that
 * cannot be reached counts as blocking: the alternative is deleting someone's identity while
 * they may still owe a payment or be owed a payout. Eligibility is re-checked at the moment of
 * the request, so the answer a page showed earlier is never trusted.
 *
 * LAX Account (with a step-up and a typed confirmation) and LAX Bid (with its own password
 * step-up) both end up in `requestDeletion`.
 */
export class AccountDeletionService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountDeletionPorts,
    now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  /** The combined answer, or null when the person no longer exists. */
  async status(subjectId: string): Promise<AccountDeletionStatus | null> {
    const [security, products] = await Promise.all([
      this.ports.operations.readSecurityStatus(subjectId),
      this.askProducts(subjectId),
    ]);
    if (!security) return null;
    return { requestedAt: security.deletionRequestedAt?.toISOString() ?? null, products };
  }

  /** Starts the grace period if nothing is in the way. No step-up: callers apply their own. */
  async requestDeletion(subjectId: string): Promise<AccountDeletionOutcome | null> {
    const status = await this.status(subjectId);
    if (!status) return null;
    const verdict = accountDeletionVerdict(status);
    if (verdict === "requested" && status.requestedAt) {
      return { outcome: "already_requested", requestedAt: status.requestedAt };
    }
    if (verdict !== "eligible") return { outcome: "not_eligible", status };
    const requestedAt = await this.ports.operations.markDeletionRequested(subjectId);
    return { outcome: "requested", requestedAt: requestedAt.toISOString() };
  }

  /** Account's request: needs a sign-in from the last few minutes. */
  async requestDeletionWithStepUp(
    subjectId: string,
    currentSessionId: string,
  ): Promise<ReauthRequired | { ok: true; outcome: AccountDeletionOutcome | null }> {
    if (!(await this.sessions.findRecent(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    return { ok: true, outcome: await this.requestDeletion(subjectId) };
  }

  /**
   * Cancels a deletion during the grace period. It only restores the status quo, so a live
   * sign-in is enough; it does nothing (and publishes nothing) when none was requested.
   */
  async cancelDeletion(
    subjectId: string,
    currentSessionId: string,
  ): Promise<ReauthRequired | { ok: true; outcome: "cancelled" | "not_requested" }> {
    const live = await this.sessions.liveSessions(subjectId);
    if (!live.some((session) => session.id === currentSessionId)) {
      return { ok: false, reason: "reauth_required" };
    }
    const security = await this.ports.operations.readSecurityStatus(subjectId);
    if (!security?.deletionRequestedAt) return { ok: true, outcome: "not_requested" };
    await this.ports.operations.cancelDeletionRequested(subjectId);
    return { ok: true, outcome: "cancelled" };
  }

  private askProducts(subjectId: string): Promise<AccountDeletionProduct[]> {
    return Promise.all(
      DELETION_ELIGIBILITY_PRODUCTS.map(async (product): Promise<AccountDeletionProduct> => {
        try {
          const answer = await this.ports.products.check(product, subjectId);
          return {
            product,
            state: answer.blockers.length > 0 ? "blocked" : "clear",
            blockers: answer.blockers,
          };
        } catch (error) {
          this.ports.onProductUnavailable?.(product, error);
          return { product, state: "unavailable", blockers: [] };
        }
      }),
    );
  }
}
