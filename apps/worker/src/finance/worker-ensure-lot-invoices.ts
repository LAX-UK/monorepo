import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { WorkerPaymentMaintenanceAdapter } from "./worker-payment-maintenance-adapter.js";

export async function runWorkerEnsureLotInvoices(input: {
  repoFactory: IRepositoryFactory;
  lotInvoice: WorkerPaymentMaintenanceAdapter;
}) {
  const lotIds = await input.repoFactory.root.lot.listSoldLotsMissingPayment(50);
  const results = await Promise.allSettled(
    lotIds.map(async (lotId) => {
      const payment = await input.lotInvoice.backfillXeroInvoiceForPayment(lotId);
      return { lotId, ...payment };
    }),
  );
  return {
    processed: lotIds.length,
    created: results.filter((r) => r.status === "fulfilled" && r.value.ok).length,
    failed: results.filter((r) => r.status === "rejected").length,
    results,
  };
}
