export interface IStalePaymentMaintenance {
  expireStalePendingPayments(
    pendingMaxAgeDays: number,
    authorizedMaxAgeDays?: number,
  ): Promise<number>;
}

export interface IRefundReconcileCronRunner {
  replayPending(limit?: number): Promise<{ attempted: number; reconciled: number }>;
}

export interface ILifecycleCronLotRunner {
  runTransitions(): Promise<void>;
}

export interface ILifecycleCronSaleReconciler {
  reconcileSaleStatuses(): Promise<void>;
}

export interface INotificationOutboxCronProcessor {
  processBatch(batchSize?: number): Promise<{
    processed: number;
    failed: number;
    pendingDepth: number;
  }>;
}
