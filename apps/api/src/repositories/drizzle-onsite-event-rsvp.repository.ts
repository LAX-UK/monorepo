import type { Database } from "@auction/db";
import { onsiteEventRsvp, user } from "@auction/db/schema";
import type { OnsiteEventRsvp, OnsiteEventRsvpAdminRow } from "@auction/types";
import { and, desc, eq } from "drizzle-orm";
import { mapOnsiteEventRsvpRow } from "../lib/onsite-event-rsvp.mapper.js";
import type {
  IOnsiteEventRsvpRepository,
  UpsertOnsiteEventRsvpInput,
} from "./interfaces/onsite-event-rsvp.repository.js";

export class DrizzleOnsiteEventRsvpRepository implements IOnsiteEventRsvpRepository {
  constructor(private readonly db: Database) {}

  async findByEventAndUser(eventSlug: string, userId: string): Promise<OnsiteEventRsvp | null> {
    const [row] = await this.db
      .select()
      .from(onsiteEventRsvp)
      .where(and(eq(onsiteEventRsvp.eventSlug, eventSlug), eq(onsiteEventRsvp.userId, userId)))
      .limit(1);
    return row ? mapOnsiteEventRsvpRow(row) : null;
  }

  async listAdminRows(eventSlug: string): Promise<OnsiteEventRsvpAdminRow[]> {
    const rows = await this.db
      .select({
        id: onsiteEventRsvp.id,
        name: user.name,
        email: user.email,
        attendanceSegment: onsiteEventRsvp.attendanceSegment,
        plusOne: onsiteEventRsvp.plusOne,
        plusOneGuestName: onsiteEventRsvp.plusOneGuestName,
        notes: onsiteEventRsvp.notes,
        createdAt: onsiteEventRsvp.createdAt,
        updatedAt: onsiteEventRsvp.updatedAt,
      })
      .from(onsiteEventRsvp)
      .innerJoin(user, eq(onsiteEventRsvp.userId, user.id))
      .where(eq(onsiteEventRsvp.eventSlug, eventSlug))
      .orderBy(desc(onsiteEventRsvp.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      attendanceSegment: row.attendanceSegment,
      plusOne: row.plusOne,
      plusOneGuestName: row.plusOneGuestName ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async upsert(input: UpsertOnsiteEventRsvpInput): Promise<OnsiteEventRsvp> {
    const now = new Date();
    const [row] = await this.db
      .insert(onsiteEventRsvp)
      .values({
        eventSlug: input.eventSlug,
        userId: input.userId,
        attendanceSegment: input.attendanceSegment,
        plusOne: input.plusOne,
        plusOneGuestName: input.plusOneGuestName,
        notes: input.notes,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [onsiteEventRsvp.eventSlug, onsiteEventRsvp.userId],
        set: {
          attendanceSegment: input.attendanceSegment,
          plusOne: input.plusOne,
          plusOneGuestName: input.plusOneGuestName,
          notes: input.notes,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) {
      throw new Error("onsite_event_rsvp upsert failed");
    }
    return mapOnsiteEventRsvpRow(row);
  }
}
