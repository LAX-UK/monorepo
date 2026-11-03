import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleDataRequestReader } from "../infrastructure/drizzle-data-request.reader.js";
import { DrizzleDataRequestWriter } from "../infrastructure/drizzle-data-request.writer.js";
import { DataRequestService } from "../services/data-request.service.js";

/** Staff's data requests: the service, and the writer the retention schedule also uses. */
export function createDataRequests(db: IdentityDatabase) {
  const writer = new DrizzleDataRequestWriter(db);
  const service = new DataRequestService({ reader: new DrizzleDataRequestReader(db), writer });
  return { service, writer };
}
