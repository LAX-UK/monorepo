import type { Database } from "@auction/db";
import { onsiteEventCheckInLog } from "@auction/db/schema";
import type {
  IOnsiteEventCheckInLogRepository,
  InsertOnsiteEventCheckInLogInput,
} from "../interfaces/onsite-event-check-in-log.repository.js";

export class DrizzleOnsiteEventCheckInLogRepository implements IOnsiteEventCheckInLogRepository {
  constructor(private readonly db: Database) {}

  async insert(input: InsertOnsiteEventCheckInLogInput): Promise<void> {
    await this.db.insert(onsiteEventCheckInLog).values({
      rsvpId: input.rsvpId,
      eventSlug: input.eventSlug,
      staffUserId: input.staffUserId,
      result: input.result,
      rawInputHash: input.rawInputHash,
    });
  }
}
