import type { Database } from "@auction/db";
import { bidIdentityDirectory, onsiteEventRsvp } from "@auction/db/schema";
import type {
  OnsiteEventCheckInSearchRow,
  OnsiteEventRsvp,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  IOnsiteEventRsvpRepository,
  OnsiteEventRsvpWithGuest,
  UpdateOnsiteEventCheckInTokenInput,
  UpsertOnsiteEventRsvpInput,
} from "../interfaces/onsite-event-rsvp.repository.js";
import { mapOnsiteEventRsvpRow } from "../lib/onsite-event-rsvp.mapper.js";

function mapRsvpWithGuest(row: {
  rsvp: typeof onsiteEventRsvp.$inferSelect;
  guestName: string;
  guestEmail: string;
  checkedInByName: string | null;
}): OnsiteEventRsvpWithGuest {
  return {
    ...mapOnsiteEventRsvpRow(row.rsvp),
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    checkedInByName: row.checkedInByName,
  };
}

const checkedInByUser = alias(bidIdentityDirectory, "checked_in_by");

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

  async findByIdWithGuest(rsvpId: string): Promise<OnsiteEventRsvpWithGuest | null> {
    const [row] = await this.db
      .select({
        rsvp: onsiteEventRsvp,
        guestName: sql<string>`coalesce(${bidIdentityDirectory.name}, 'Deleted user')`,
        guestEmail: sql<string>`coalesce(${bidIdentityDirectory.email}, '[deleted]')`,
        checkedInByName: checkedInByUser.name,
      })
      .from(onsiteEventRsvp)
      .leftJoin(bidIdentityDirectory, eq(onsiteEventRsvp.userId, bidIdentityDirectory.subjectId))
      .leftJoin(checkedInByUser, eq(onsiteEventRsvp.checkedInByUserId, checkedInByUser.subjectId))
      .where(eq(onsiteEventRsvp.id, rsvpId))
      .limit(1);
    return row ? mapRsvpWithGuest(row) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<OnsiteEventRsvpWithGuest | null> {
    const [row] = await this.db
      .select({
        rsvp: onsiteEventRsvp,
        guestName: bidIdentityDirectory.name,
        guestEmail: bidIdentityDirectory.email,
        checkedInByName: checkedInByUser.name,
      })
      .from(onsiteEventRsvp)
      .innerJoin(bidIdentityDirectory, eq(onsiteEventRsvp.userId, bidIdentityDirectory.subjectId))
      .leftJoin(checkedInByUser, eq(onsiteEventRsvp.checkedInByUserId, checkedInByUser.subjectId))
      .where(eq(onsiteEventRsvp.checkInTokenHash, tokenHash))
      .limit(1);
    return row ? mapRsvpWithGuest(row) : null;
  }

  async listAdminRows(eventSlug: string): Promise<OnsiteEventRsvpAdminRow[]> {
    const rows = await this.db
      .select({
        id: onsiteEventRsvp.id,
        name: sql<string>`coalesce(${bidIdentityDirectory.name}, 'Deleted user')`,
        email: sql<string>`coalesce(${bidIdentityDirectory.email}, '[deleted]')`,
        attendanceSegment: onsiteEventRsvp.attendanceSegment,
        plusOne: onsiteEventRsvp.plusOne,
        plusOneGuestName: onsiteEventRsvp.plusOneGuestName,
        notes: onsiteEventRsvp.notes,
        checkedInAt: onsiteEventRsvp.checkedInAt,
        checkInPartyCount: onsiteEventRsvp.checkInPartyCount,
        createdAt: onsiteEventRsvp.createdAt,
        updatedAt: onsiteEventRsvp.updatedAt,
      })
      .from(onsiteEventRsvp)
      .leftJoin(bidIdentityDirectory, eq(onsiteEventRsvp.userId, bidIdentityDirectory.subjectId))
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
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      checkInPartyCount: row.checkInPartyCount ?? null,
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
        checkInTokenHash: input.checkInTokenHash,
        checkInTokenIssuedAt: input.checkInTokenIssuedAt,
        checkInTokenCiphertext: input.checkInTokenCiphertext,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [onsiteEventRsvp.eventSlug, onsiteEventRsvp.userId],
        set: {
          attendanceSegment: input.attendanceSegment,
          plusOne: input.plusOne,
          plusOneGuestName: input.plusOneGuestName,
          notes: input.notes,
          checkInTokenHash: input.checkInTokenHash,
          checkInTokenIssuedAt: input.checkInTokenIssuedAt,
          checkInTokenCiphertext: input.checkInTokenCiphertext,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) {
      throw new Error("onsite_event_rsvp upsert failed");
    }
    return mapOnsiteEventRsvpRow(row);
  }

  async updateCheckInToken(
    rsvpId: string,
    input: UpdateOnsiteEventCheckInTokenInput,
  ): Promise<OnsiteEventRsvp | null> {
    const [row] = await this.db
      .update(onsiteEventRsvp)
      .set({
        checkInTokenHash: input.checkInTokenHash,
        checkInTokenIssuedAt: input.checkInTokenIssuedAt,
        checkInTokenCiphertext: input.checkInTokenCiphertext,
        updatedAt: new Date(),
      })
      .where(eq(onsiteEventRsvp.id, rsvpId))
      .returning();
    return row ? mapOnsiteEventRsvpRow(row) : null;
  }

  async issueTokenIfMissing(
    rsvpId: string,
    tokenHash: string,
    issuedAt: Date,
  ): Promise<OnsiteEventRsvp | null> {
    const [row] = await this.db
      .update(onsiteEventRsvp)
      .set({
        checkInTokenHash: tokenHash,
        checkInTokenIssuedAt: issuedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(onsiteEventRsvp.id, rsvpId), sql`${onsiteEventRsvp.checkInTokenHash} IS NULL`))
      .returning();
    return row ? mapOnsiteEventRsvpRow(row) : null;
  }

  async atomicCheckIn(input: {
    rsvpId: string;
    staffUserId: string;
    partyCount: number;
  }): Promise<OnsiteEventRsvpWithGuest | null> {
    const now = new Date();
    const [updated] = await this.db
      .update(onsiteEventRsvp)
      .set({
        checkedInAt: now,
        checkedInByUserId: input.staffUserId,
        checkInPartyCount: input.partyCount,
        updatedAt: now,
      })
      .where(and(eq(onsiteEventRsvp.id, input.rsvpId), sql`${onsiteEventRsvp.checkedInAt} IS NULL`))
      .returning();

    if (!updated) return null;

    const [row] = await this.db
      .select({
        rsvp: onsiteEventRsvp,
        guestName: bidIdentityDirectory.name,
        guestEmail: bidIdentityDirectory.email,
        checkedInByName: checkedInByUser.name,
      })
      .from(onsiteEventRsvp)
      .innerJoin(bidIdentityDirectory, eq(onsiteEventRsvp.userId, bidIdentityDirectory.subjectId))
      .leftJoin(checkedInByUser, eq(onsiteEventRsvp.checkedInByUserId, checkedInByUser.subjectId))
      .where(eq(onsiteEventRsvp.id, input.rsvpId))
      .limit(1);

    return row ? mapRsvpWithGuest(row) : null;
  }

  async searchForCheckIn(
    eventSlug: string,
    query: string,
    limit = 20,
  ): Promise<OnsiteEventCheckInSearchRow[]> {
    const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    const rows = await this.db
      .select({
        id: onsiteEventRsvp.id,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
        attendanceSegment: onsiteEventRsvp.attendanceSegment,
        plusOne: onsiteEventRsvp.plusOne,
        plusOneGuestName: onsiteEventRsvp.plusOneGuestName,
        checkedInAt: onsiteEventRsvp.checkedInAt,
      })
      .from(onsiteEventRsvp)
      .innerJoin(bidIdentityDirectory, eq(onsiteEventRsvp.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(onsiteEventRsvp.eventSlug, eventSlug),
          or(ilike(bidIdentityDirectory.name, pattern), ilike(bidIdentityDirectory.email, pattern)),
        ),
      )
      .orderBy(desc(onsiteEventRsvp.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      rsvpId: row.id,
      name: row.name,
      email: row.email,
      attendanceSegment: row.attendanceSegment,
      attendanceSegmentLabel: row.attendanceSegment,
      plusOne: row.plusOne,
      plusOneGuestName: row.plusOneGuestName ?? null,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
    }));
  }

  async countCheckInStats(eventSlug: string): Promise<{ total: number; checkedIn: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        checkedIn: sql<number>`count(${onsiteEventRsvp.checkedInAt})::int`,
      })
      .from(onsiteEventRsvp)
      .where(eq(onsiteEventRsvp.eventSlug, eventSlug));
    return { total: row?.total ?? 0, checkedIn: row?.checkedIn ?? 0 };
  }
}
