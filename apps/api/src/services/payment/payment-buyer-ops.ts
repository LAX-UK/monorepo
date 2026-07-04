import type { PaymentStatus } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import { type MyPaymentRowDTO, presentMyPayments } from "../payment-me-presenter.js";
import { revokeOpenStripeCheckoutForPayment } from "./checkout-orchestrator.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

export { createPendingForWinner } from "./create-pending-for-winner.pipeline.js";

export async function listForBuyer(
  deps: PaymentServiceDeps,
  buyerId: string,
): Promise<import("@auction/persistence/interfaces").PaymentRecord[]> {
  return deps.payments.listByBuyerId(buyerId);
}

/** Buyer dashboard: list, optional status filter, lot hydration, presentation. */
export async function listMyPaymentsForBuyerApi(
  deps: PaymentServiceDeps,
  userId: string,
  options: { status?: PaymentStatus },
): Promise<{ data: MyPaymentRowDTO[] }> {
  const all = await listForBuyer(deps, userId);
  const filtered = options.status ? all.filter((p) => p.status === options.status) : all;
  const lotIds = Array.from(new Set(filtered.map((p) => p.lotId)));
  const lots = await Promise.all(lotIds.map((id) => deps.lots.findById(id)));
  const lotById = new Map<string, NonNullable<(typeof lots)[number]>>();
  for (const lot of lots) {
    if (lot) lotById.set(lot.id, lot);
  }
  const sellerArchivedByEntityId = new Map<string, boolean>();
  if (deps.legalEntityRepository) {
    const legalEntityRepository = deps.legalEntityRepository;
    const sellerIds = Array.from(
      new Set(
        filtered
          .map((p) => p.sellerLegalEntityId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    await Promise.all(
      sellerIds.map(async (id) => {
        const entity = await legalEntityRepository.findById(id);
        if (entity) sellerArchivedByEntityId.set(id, entity.status === "archived");
      }),
    );
  }
  const data = await presentMyPayments(filtered, lotById, deps.mediaUrlResolver, {
    paymentTierPolicy: deps.paymentTierPolicy,
    sellerArchivedByEntityId,
    settlementCompliance: deps.settlementCompliance,
  });
  return { data };
}

/**
 * Pre-flight read-only compliance gate for buyer surfaces. Surfaces an active
 * AML hold or an open (pending) Source-of-Funds case without creating a
 * payment row and without any side effects (no SoF case creation, no events) —
 * safe to call from GET handlers on every checkout/portfolio load.
 */
export async function getBuyerComplianceGateStatus(
  deps: PaymentServiceDeps,
  userId: string,
): Promise<{ status: "clear" | "aml_hold" | "source_of_funds_required" }> {
  if (!deps.settlementCompliance) return { status: "clear" };
  const decision = await deps.settlementCompliance.peek(userId);
  if (decision.hold) {
    const reason = decision.reason;
    if (reason === "aml_hold" || reason === "source_of_funds_required") {
      return { status: reason };
    }
  }
  return { status: "clear" };
}

/** Buyer abandons an unpaid pending invoice (e.g. relinquishes the win). */
export async function cancelPendingAsBuyer(
  deps: PaymentServiceDeps,
  buyerId: string,
  paymentId: string,
): Promise<Result<void, AuthzError | LotError>> {
  const p = await deps.payments.findById(paymentId);
  if (!p) return err(new LotError("Payment not found", 404));
  if (p.paidByUserId !== buyerId) {
    return err(new AuthzError("Only the buyer can cancel this payment", 403));
  }
  if (p.status !== "pending") {
    return err(new LotError("Only pending payments can be cancelled", 409));
  }
  await deps.payments.updateStatus(paymentId, "cancelled");
  await revokeOpenStripeCheckoutForPayment(deps.checkoutOrchestratorDeps, paymentId);
  if (deps.domainEventSink) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: paymentId,
      eventType: "payment.cancelled",
      payload: {
        lotId: p.lotId,
        buyerUserId: buyerId,
        reason: "buyer_abandoned",
      },
      actorUserId: buyerId,
      actingLegalEntityId: p.buyerLegalEntityId ?? null,
    });
  }
  return ok(undefined);
}

/** Cron: expire pending and authorized payments older than configured thresholds. */
export async function expireStalePendingPayments(
  deps: PaymentServiceDeps,
  pendingMaxAgeDays: number,
  authorizedMaxAgeDays?: number,
): Promise<number> {
  const pendingCutoff = new Date(Date.now() - pendingMaxAgeDays * 86_400_000);
  const stalePending = await deps.payments.listStalePendingBefore(pendingCutoff);
  const authorizedDays = authorizedMaxAgeDays ?? pendingMaxAgeDays * 2;
  const authorizedCutoff = new Date(Date.now() - authorizedDays * 86_400_000);
  const staleAuthorized = await deps.payments.listStaleAuthorizedBefore(authorizedCutoff);
  let expired = 0;
  for (const row of stalePending) {
    await cancelStalePayment(deps, row, "stale_pending_expired");
    expired += 1;
  }
  for (const row of staleAuthorized) {
    await cancelStalePayment(deps, row, "stale_authorized_expired");
    expired += 1;
  }
  return expired;
}

async function cancelStalePayment(
  deps: PaymentServiceDeps,
  row: { id: string; lotId: string; buyerId: string },
  reason: string,
): Promise<void> {
  await deps.payments.updateStatus(row.id, "cancelled");
  await revokeOpenStripeCheckoutForPayment(deps.checkoutOrchestratorDeps, row.id);
  if (deps.domainEventSink) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: row.id,
      eventType: "payment.cancelled",
      payload: {
        lotId: row.lotId,
        buyerUserId: row.buyerId,
        reason,
      },
      actorUserId: null,
      actingLegalEntityId: null,
    });
  }
}
