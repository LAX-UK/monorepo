import { ATG_SYNC_JOB_NAMES } from "@auction/queues";
import { AtgGatewayError } from "./atg-gateway.js";
import { AtgMappingError } from "./atg-mappers.js";
import { AtgSyncPreconditionError, type AtgSyncService } from "./atg-sync-service.js";

type JobLike = { name: string; data: unknown };

function stringField(data: unknown, key: string): string {
  const value = data && typeof data === "object" ? (data as Record<string, unknown>)[key] : null;
  if (typeof value !== "string" || !value) {
    throw new AtgSyncPreconditionError(`Job data is missing "${key}"`);
  }
  return value;
}

/** True when retrying the job cannot change the outcome. */
export function isPermanentAtgJobError(err: unknown): boolean {
  return (
    err instanceof AtgSyncPreconditionError ||
    err instanceof AtgMappingError ||
    (err instanceof AtgGatewayError && !err.retryable)
  );
}

/** Routes an `atg-sync` job to the sync service and returns a loggable result. */
export async function processAtgSyncJob(job: JobLike, service: AtgSyncService): Promise<unknown> {
  switch (job.name) {
    case ATG_SYNC_JOB_NAMES.pushSale:
      return service.pushSale(stringField(job.data, "saleId"));
    case ATG_SYNC_JOB_NAMES.publishSale:
      await service.publishSale(stringField(job.data, "saleId"));
      return { published: true };
    case ATG_SYNC_JOB_NAMES.closeSale:
      await service.closeSale(stringField(job.data, "saleId"));
      return { closed: true };
    case ATG_SYNC_JOB_NAMES.deleteLot:
      await service.deleteLot(stringField(job.data, "lotId"));
      return { deleted: true };
    case ATG_SYNC_JOB_NAMES.tick:
      return service.tick();
    default:
      throw new AtgSyncPreconditionError(`Unknown atg-sync job "${job.name}"`);
  }
}
