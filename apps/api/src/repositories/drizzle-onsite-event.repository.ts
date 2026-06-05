import type { Database } from "@auction/db";
import { onsiteEvent, onsiteEventRsvp } from "@auction/db/schema";
import type { OnsiteEvent, OnsiteEventListItem, OnsiteEventStatus } from "@auction/types";
import { count, desc, eq } from "drizzle-orm";
import { mapOnsiteEventRow } from "../lib/onsite-event.mapper.js";
import type { IOnsiteEventRepository } from "./interfaces/onsite-event.repository.js";

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

  async listAdminItems(): Promise<OnsiteEventListItem[]> {
    const rows = await this.db
      .select()
      .from(onsiteEvent)
      .orderBy(desc(onsiteEvent.startsAt), desc(onsiteEvent.createdAt));

    return Promise.all(
      rows.map(async (row) => {
        const [rsvpRow] = await this.db
          .select({ n: count() })
          .from(onsiteEventRsvp)
          .where(eq(onsiteEventRsvp.eventSlug, row.slug));

        return {
          slug: row.slug,
          title: row.title,
          startsAt: row.startsAt?.toISOString() ?? null,
          rsvpCloseAt: row.rsvpCloseAt?.toISOString() ?? null,
          status: parseStatus(row.status),
          rsvpCount: Number(rsvpRow?.n ?? 0),
        };
      }),
    );
  }
}
