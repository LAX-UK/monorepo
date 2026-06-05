import type { OnsiteEventCheckInLogResult } from "@auction/types";

export type InsertOnsiteEventCheckInLogInput = {
  rsvpId: string | null;
  eventSlug: string;
  staffUserId: string | null;
  result: OnsiteEventCheckInLogResult;
  rawInputHash: string | null;
};

export interface IOnsiteEventCheckInLogRepository {
  insert(input: InsertOnsiteEventCheckInLogInput): Promise<void>;
}
