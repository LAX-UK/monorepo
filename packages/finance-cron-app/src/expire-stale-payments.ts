export type PaymentMaintenanceCronPorts = {
  listStalePendingBefore(cutoff: Date): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  listStaleAuthorizedBefore(
    cutoff: Date,
  ): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  cancelPayment(paymentId: string): Promise<void>;
  publishPaymentCancelled(event: {
    paymentId: string;
    lotId: string;
    buyerUserId: string;
    reason: string;
  }): Promise<void>;
};

export async function expireStalePaymentsWithPorts(
  ports: PaymentMaintenanceCronPorts,
  pendingMaxAgeDays: number,
  authorizedMaxAgeDays: number,
): Promise<{ expired: number }> {
  const pendingCutoff = new Date(Date.now() - pendingMaxAgeDays * 86_400_000);
  const authorizedCutoff = new Date(Date.now() - authorizedMaxAgeDays * 86_400_000);
  const stalePending = await ports.listStalePendingBefore(pendingCutoff);
  const staleAuthorized = await ports.listStaleAuthorizedBefore(authorizedCutoff);
  let expired = 0;
  for (const row of stalePending) {
    await ports.cancelPayment(row.id);
    await ports.publishPaymentCancelled({
      paymentId: row.id,
      lotId: row.lotId,
      buyerUserId: row.buyerId,
      reason: "stale_pending_expired",
    });
    expired += 1;
  }
  for (const row of staleAuthorized) {
    await ports.cancelPayment(row.id);
    await ports.publishPaymentCancelled({
      paymentId: row.id,
      lotId: row.lotId,
      buyerUserId: row.buyerId,
      reason: "stale_authorized_expired",
    });
    expired += 1;
  }
  return { expired };
}
