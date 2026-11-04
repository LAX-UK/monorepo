import type { Database } from "@auction/db";
import {
  artworkRegisterConflict as conflict,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  ArtworkRegisterArtistCount,
  IArtworkRegisterQueue,
  QueuedConflict,
  RegisterQueueFilter,
  RegisterQueuePage,
} from "../../interfaces/artwork-register-queue.js";
import type { RegisterConflict } from "../../interfaces/artwork-register.js";
import { toConflict, toEntry } from "./artwork-register.mapper.js";
import { queueFilterCondition } from "./register-queue-filters.js";

const HELD = eq(register.offerState, "held");
const OPEN = eq(conflict.status, "open");

export class DrizzleArtworkRegisterQueueReader implements IArtworkRegisterQueue {
  constructor(private readonly db: Database) {}

  async listHeld(filter: RegisterQueueFilter, page: RegisterQueuePage) {
    const where = and(HELD, queueFilterCondition(filter));
    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(register)
        .where(where)
        .orderBy(sql`${register.zohoModifiedAt} DESC NULLS LAST`, asc(register.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(register).where(where),
    ]);
    return { entries: rows.map(toEntry), total: counted?.total ?? 0 };
  }

  async listOpenConflicts(filter: RegisterQueueFilter, page: RegisterQueuePage) {
    const where = and(OPEN, queueFilterCondition(filter));
    const [rows, [counted]] = await Promise.all([
      this.db
        .select({ conflict, entry: register })
        .from(conflict)
        .innerJoin(register, eq(register.id, conflict.registerId))
        .where(where)
        .orderBy(asc(conflict.detectedAt), asc(conflict.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(conflict)
        .innerJoin(register, eq(register.id, conflict.registerId))
        .where(where),
    ]);
    const items: QueuedConflict[] = rows.map((row) => ({
      conflict: toConflict(row.conflict),
      entry: toEntry(row.entry),
    }));
    return { items, total: counted?.total ?? 0 };
  }

  async listConflictsFor(registerId: string): Promise<RegisterConflict[]> {
    const rows = await this.db
      .select()
      .from(conflict)
      .where(eq(conflict.registerId, registerId))
      .orderBy(
        sql`(${conflict.status} = 'open') DESC`,
        desc(conflict.detectedAt),
        desc(conflict.id),
      );
    return rows.map(toConflict);
  }

  async countHeld(): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(register)
      .where(HELD);
    return row?.total ?? 0;
  }

  async countOpenConflicts(): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(conflict)
      .where(OPEN);
    return row?.total ?? 0;
  }

  async listHeldArtists(): Promise<ArtworkRegisterArtistCount[]> {
    return this.db
      .select({
        code: register.artistCode,
        name: sql<string>`min(${register.artistName})`,
        count: sql<number>`count(*)::int`,
      })
      .from(register)
      .where(HELD)
      .groupBy(register.artistCode)
      .orderBy(sql`min(${register.artistName})`, asc(register.artistCode));
  }
}
