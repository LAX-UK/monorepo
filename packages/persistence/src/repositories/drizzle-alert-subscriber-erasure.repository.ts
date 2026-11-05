import type { Database } from "@auction/db";
import type {
  AlertSubscriberErasureCounts,
  AlertSubscriberErasureTarget,
  IAlertSubscriberErasureRepository,
} from "../interfaces/alert-subscriber-erasure.repository.js";
import { eraseAlertSubscribers } from "../lib/erase-alert-subscribers.js";

/** Bid's alert subscription erasure, as a port for services that run inside a transaction. */
export class DrizzleAlertSubscriberErasureRepository implements IAlertSubscriberErasureRepository {
  eraseInTransaction(
    tx: Database,
    target: AlertSubscriberErasureTarget,
  ): Promise<AlertSubscriberErasureCounts> {
    return eraseAlertSubscribers(tx, target);
  }
}
