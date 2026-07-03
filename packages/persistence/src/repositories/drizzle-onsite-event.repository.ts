import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { onsiteEvent, onsiteEventRsvp, sale } from "@auction/db/schema";
import type {
  OnsiteEvent,
  OnsiteEventListItem,
  OnsiteEventPublicListItem,
  OnsiteEventStatus,
} from "@auction/types";
import { and, asc, count, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type {
  CreateOnsiteEventInput,
  IOnsiteEventRepository,
  UpdateOnsiteEventInput,
} from "../interfaces/onsite-event.repository.js";
import { mapOnsiteEventRow } from "../lib/onsite-event.mapper.js";

const STATUSES = new Set<OnsiteEventStatus>(["draft", "published", "closed"]);

function parseStatus(value: string): OnsiteEventStatus {
  return STATUSES.has(value as OnsiteEventStatus) ? (value as OnsiteEventStatus) : "draft";
}

export class DrizzleOnsiteEventRepository implements IOnsiteEventRepository {
  constructor(private readonly db: Database) {}

  async findBySlug(slug: string): Promise<OnsiteEvent | null> {
    const [row] = await this.db
      .select()
      .from(onsiteEvent)
      .where(eq(onsiteEvent.slug, slug))
      .limit(1);
    return row ? mapOnsiteEventRow(row) : null;
  }

  async findBySaleId(saleId: string): Promise<OnsiteEvent | null> {
    const [row] = await this.db
      .select({ event: onsiteEvent })
      .from(onsiteEvent)
      .innerJoin(sale, eq(sale.id, onsiteEvent.saleId))
      .where(and(eq(onsiteEvent.saleId, saleId), saleNotDeleted()))
      .limit(1);
    return row ? mapOnsiteEventRow(row.event) : null;
  }

  async listPublicUpcoming(): Promise<OnsiteEventPublicListItem[]> {
    const now = new Date();
    const rows = await this.db
      .select({
        slug: onsiteEvent.slug,
        title: onsiteEvent.title,
        startsAt: onsiteEvent.startsAt,
        venue: onsiteEvent.venue,
        dressCode: onsiteEvent.dressCode,
        micrositeUrl: onsiteEvent.micrositeUrl,
        deliveryMode: sale.deliveryMode,
      })
      .from(onsiteEvent)
      .leftJoin(sale, and(eq(sale.id, onsiteEvent.saleId), saleNotDeleted()))
      .where(
        and(
          eq(onsiteEvent.status, "published"),
          or(isNull(onsiteEvent.startsAt), gte(onsiteEvent.startsAt, now)),
        ),
      )
      .orderBy(sql`${onsiteEvent.startsAt} asc nulls last`, asc(onsiteEvent.createdAt));

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      startsAt: row.startsAt?.toISOString() ?? null,
      venue: row.venue,
      dressCode: row.dressCode,
      micrositeUrl: row.micrositeUrl,
      deliveryMode:
        row.deliveryMode === "onsite" || row.deliveryMode === "hybrid" ? row.deliveryMode : null,
    }));
  }

  async create(input: CreateOnsiteEventInput): Promise<OnsiteEvent> {
    const [row] = await this.db
      .insert(onsiteEvent)
      .values({
        slug: input.slug,
        title: input.title,
        startsAt: input.startsAt ?? null,
        rsvpCloseAt: input.rsvpCloseAt ?? null,
        segmentOptions: input.segmentOptions,
        opsEmail: input.opsEmail ?? null,
        micrositeUrl: input.micrositeUrl ?? null,
        venue: input.venue ?? null,
        dressCode: input.dressCode ?? null,
        arrivalNote: input.arrivalNote ?? null,
        status: input.status ?? "draft",
        saleId: input.saleId ?? null,
      })
      .returning();
    if (!row) throw new Error("Could not create onsite event");
    return mapOnsiteEventRow(row);
  }

  async update(slug: string, input: UpdateOnsiteEventInput): Promise<OnsiteEvent | null> {
    const [row] = await this.db
      .update(onsiteEvent)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(onsiteEvent.slug, slug))
      .returning();
    return row ? mapOnsiteEventRow(row) : null;
  }

  async updateCheckInDryRun(slug: string, enabled: boolean): Promise<OnsiteEvent | null> {
    const [row] = await this.db
      .update(onsiteEvent)
      .set({ checkInDryRun: enabled, updatedAt: new Date() })
      .where(eq(onsiteEvent.slug, slug))
      .returning();
    return row ? mapOnsiteEventRow(row) : null;
  }

  async listAdminItems(): Promise<OnsiteEventListItem[]> {
    const rows = await this.db
      .select({
        slug: onsiteEvent.slug,
        title: onsiteEvent.title,
        startsAt: onsiteEvent.startsAt,
        rsvpCloseAt: onsiteEvent.rsvpCloseAt,
        status: onsiteEvent.status,
        saleId: onsiteEvent.saleId,
        rsvpCount: count(onsiteEventRsvp.id),
      })
      .from(onsiteEvent)
      .leftJoin(onsiteEventRsvp, eq(onsiteEventRsvp.eventSlug, onsiteEvent.slug))
      .groupBy(onsiteEvent.slug)
      .orderBy(desc(onsiteEvent.startsAt), desc(onsiteEvent.createdAt));

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      startsAt: row.startsAt?.toISOString() ?? null,
      rsvpCloseAt: row.rsvpCloseAt?.toISOString() ?? null,
      status: parseStatus(row.status),
      rsvpCount: Number(row.rsvpCount ?? 0),
      saleId: row.saleId,
    }));
  }
}
