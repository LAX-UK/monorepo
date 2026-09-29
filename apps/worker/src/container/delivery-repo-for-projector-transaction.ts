import type { Database } from "@auction/db";
import type { IDomainEventDeliveryRepository } from "@auction/persistence/interfaces";
import { DrizzleDomainEventDeliveryRepository } from "@auction/persistence/repositories";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";

function isDrizzleDatabase(conn: ProjectorDbConnection): conn is Database {
  return typeof (conn as Database).insert === "function";
}

/** Use the open projector transaction for enqueue; avoids cross-connection deadlocks. */
export function deliveryRepoForProjectorTransaction(
  tx: ProjectorDbConnection,
  fallback: IDomainEventDeliveryRepository,
): IDomainEventDeliveryRepository {
  if (isDrizzleDatabase(tx)) {
    return new DrizzleDomainEventDeliveryRepository(tx);
  }
  return fallback;
}
