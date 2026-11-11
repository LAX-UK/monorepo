import type { RegisterLink } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  artworkRegisterSoldAttention as attention,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type {
  ISoldAttentionStore,
  OverrideSoldAttentionResult,
  RaiseSoldAttentionInput,
  ResolveSoldAttentionInput,
  SoldAttentionItem,
  SoldAttentionRecord,
} from "../../interfaces/artwork-register-sold-attention.js";
import { toEntry } from "./artwork-register.mapper.js";
import { appendRegisterEvent } from "./register-event-writer.js";

const SYSTEM_ACTOR = "zoho";
const LIVE = ["open", "overridden"] as const;

function toRecord(row: typeof attention.$inferSelect): SoldAttentionRecord {
  return { ...row };
}

export class DrizzleSoldAttentionStore implements ISoldAttentionStore {
  constructor(private readonly db: Database) {}

  async findLive(registerId: string): Promise<SoldAttentionRecord | null> {
    const [row] = await this.db
      .select()
      .from(attention)
      .where(and(eq(attention.registerId, registerId), inArray(attention.status, [...LIVE])))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async raise(input: RaiseSoldAttentionInput): Promise<{ raised: boolean }> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(attention)
        .values({
          registerId: input.registerId,
          zohoProductId: input.zohoProductId,
          zohoStatus: input.zohoStatus,
          place: input.place,
          placeRefId: input.placeRefId,
          markedAt: input.markedAt,
          raisedAt: input.now,
        })
        .onConflictDoNothing()
        .returning({ id: attention.id });
      if (!created) return { raised: false };
      await appendRegisterEvent(tx, {
        registerId: input.registerId,
        type: "sold_while_live_raised",
        actor: SYSTEM_ACTOR,
        now: input.now,
        payload: {
          attentionId: created.id,
          status: input.zohoStatus,
          place: input.place,
          placeRefId: input.placeRefId,
          markedAt: input.markedAt.toISOString(),
        },
      });
      return { raised: true };
    });
  }

  async resolve(input: ResolveSoldAttentionInput): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [closed] = await tx
        .update(attention)
        .set({
          status: "resolved",
          resolution: input.resolution,
          resolvedBy: SYSTEM_ACTOR,
          resolvedAt: input.now,
        })
        .where(and(eq(attention.id, input.id), inArray(attention.status, [...LIVE])))
        .returning({ registerId: attention.registerId, zohoStatus: attention.zohoStatus });
      if (!closed) return false;
      await appendRegisterEvent(tx, {
        registerId: closed.registerId,
        type: "sold_while_live_resolved",
        actor: SYSTEM_ACTOR,
        now: input.now,
        payload: {
          attentionId: input.id,
          status: closed.zohoStatus,
          resolution: input.resolution,
        },
      });
      return true;
    });
  }

  async override(input: {
    id: string;
    reason: string;
    actor: string;
    now: Date;
  }): Promise<OverrideSoldAttentionResult> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(attention)
        .set({
          status: "overridden",
          resolution: "staff_override",
          resolvedBy: input.actor,
          overrideReason: input.reason,
          resolvedAt: input.now,
        })
        .where(and(eq(attention.id, input.id), eq(attention.status, "open")))
        .returning();
      if (!row) {
        const [existing] = await tx
          .select({ id: attention.id })
          .from(attention)
          .where(eq(attention.id, input.id))
          .limit(1);
        return { ok: false, reason: existing ? "not_open" : "not_found" };
      }
      await appendRegisterEvent(tx, {
        registerId: row.registerId,
        type: "sold_while_live_overridden",
        actor: input.actor,
        now: input.now,
        payload: { attentionId: row.id, status: row.zohoStatus, reason: input.reason },
      });
      return { ok: true, item: toRecord(row) };
    });
  }

  async listOpen(limit: number): Promise<SoldAttentionItem[]> {
    const rows = await this.db
      .select({ item: attention, entry: register })
      .from(attention)
      .innerJoin(register, eq(register.id, attention.registerId))
      .where(eq(attention.status, "open"))
      .orderBy(asc(attention.raisedAt), asc(attention.id))
      .limit(limit);
    return rows.map((row) => ({ item: toRecord(row.item), entry: toEntry(row.entry) }));
  }

  async countOpen(): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(attention)
      .where(eq(attention.status, "open"));
    return row?.total ?? 0;
  }

  async listLiveRegisterIds(limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ registerId: attention.registerId })
      .from(attention)
      .where(inArray(attention.status, [...LIVE]))
      .orderBy(asc(attention.raisedAt))
      .limit(limit);
    return rows.map((row) => row.registerId);
  }

  async isPaused(link: RegisterLink): Promise<boolean> {
    const match =
      "registerId" in link
        ? eq(attention.registerId, link.registerId)
        : eq(attention.zohoProductId, link.zohoProductId);
    const [row] = await this.db
      .select({ one: sql<number>`1` })
      .from(attention)
      .where(and(match, eq(attention.status, "open")))
      .limit(1);
    return row !== undefined;
  }
}
