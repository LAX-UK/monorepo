import { type Database, domainEvent, ssfDelivery, ssfStream } from "@auction/db";
import { SSF_VERIFICATION_EVENT } from "@auction/identity-contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  SsfDeliveryRepository,
  SsfSourceEventReader,
  SsfStreamRecord,
  SsfStreamRepository,
} from "../services/ssf.ports.js";

const toRecord = (row: typeof ssfStream.$inferSelect): SsfStreamRecord => ({
  id: row.id,
  clientId: row.clientId,
  audience: row.audience,
  endpoint: row.endpoint,
  status: row.status as SsfStreamRecord["status"],
  eventsRequested: row.eventsRequested,
  eventsDelivered: row.eventsDelivered,
  lastMappedEventId: row.lastMappedEventId,
  signingKid: row.signingKid,
});

export class DrizzleSsfStreamRepository implements SsfStreamRepository {
  constructor(private readonly db: Database) {}

  async currentDomainEventId(): Promise<number> {
    const [row] = await this.db
      .select({ id: sql<number>`coalesce(max(${domainEvent.id}), 0)::bigint` })
      .from(domainEvent);
    return Number(row?.id ?? 0);
  }

  async provision(input: Parameters<SsfStreamRepository["provision"]>[0]): Promise<void> {
    await this.db
      .insert(ssfStream)
      .values({
        id: input.id,
        clientId: input.clientId,
        receiverId: input.clientId,
        audience: input.audience,
        endpoint: input.endpoint,
        status: input.enabled ? "enabled" : "disabled",
        eventsRequested: input.events,
        eventsDelivered: input.events,
        lastMappedEventId: input.checkpoint,
      })
      .onConflictDoUpdate({
        target: [ssfStream.clientId, ssfStream.receiverId],
        set: {
          audience: input.audience,
          endpoint: input.endpoint,
          eventsRequested: input.events,
          eventsDelivered: input.events,
          ...(input.enabled
            ? { status: "enabled" as const, lastMappedEventId: input.checkpoint }
            : {}),
          updatedAt: input.now,
        },
      });
  }

  async create(input: Omit<SsfStreamRecord, "signingKid">): Promise<SsfStreamRecord> {
    const [row] = await this.db
      .insert(ssfStream)
      .values({ ...input, receiverId: input.clientId })
      .returning();
    if (!row) throw new Error("stream_create_failed");
    return toRecord(row);
  }

  async read(clientId: string, streamId?: string): Promise<SsfStreamRecord[]> {
    const rows = await this.db
      .select()
      .from(ssfStream)
      .where(
        streamId
          ? and(eq(ssfStream.clientId, clientId), eq(ssfStream.id, streamId))
          : eq(ssfStream.clientId, clientId),
      );
    return rows.map(toRecord);
  }

  async update(
    clientId: string,
    streamId: string,
    input: Parameters<SsfStreamRepository["update"]>[2],
  ): Promise<SsfStreamRecord | null> {
    const [row] = await this.db
      .update(ssfStream)
      .set({
        ...(input.endpoint ? { endpoint: input.endpoint } : {}),
        ...(input.eventsRequested ? { eventsRequested: input.eventsRequested } : {}),
        ...(input.eventsDelivered ? { eventsDelivered: input.eventsDelivered } : {}),
        updatedAt: input.now,
      })
      .where(and(eq(ssfStream.id, streamId), eq(ssfStream.clientId, clientId)))
      .returning();
    return row ? toRecord(row) : null;
  }

  async delete(clientId: string, streamId: string): Promise<boolean> {
    const rows = await this.db
      .delete(ssfStream)
      .where(and(eq(ssfStream.id, streamId), eq(ssfStream.clientId, clientId)))
      .returning({ id: ssfStream.id });
    return rows.length > 0;
  }

  async setStatus(input: Parameters<SsfStreamRepository["setStatus"]>[0]): Promise<boolean> {
    const rows = await this.db
      .update(ssfStream)
      .set({
        status: input.status,
        ...(input.resetCheckpoint === undefined
          ? {}
          : { lastMappedEventId: input.resetCheckpoint }),
        updatedAt: input.now,
      })
      .where(and(eq(ssfStream.id, input.streamId), eq(ssfStream.clientId, input.clientId)))
      .returning({ id: ssfStream.id });
    return rows.length > 0;
  }

  async enabledStreams(): Promise<SsfStreamRecord[]> {
    return (await this.db.select().from(ssfStream).where(eq(ssfStream.status, "enabled"))).map(
      toRecord,
    );
  }

  async advanceCheckpoint(streamId: string, eventId: number, now: Date): Promise<void> {
    await this.db
      .update(ssfStream)
      .set({
        lastMappedEventId: sql`greatest(${ssfStream.lastMappedEventId}, ${eventId})`,
        updatedAt: now,
      })
      .where(eq(ssfStream.id, streamId));
  }
}

export class DrizzleSsfSourceEventReader implements SsfSourceEventReader {
  constructor(private readonly db: Database) {}

  readUnmapped(
    streamId: string,
    afterEventId: number,
    domainEventTypes: readonly string[],
    limit: number,
  ) {
    return this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        aggregateId: domainEvent.aggregateId,
        payload: domainEvent.payload,
        correlationId: domainEvent.correlationId,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          inArray(domainEvent.eventType, [...domainEventTypes]),
          sql`${domainEvent.id} > ${afterEventId}`,
          sql`not exists (
            select 1 from ${ssfDelivery}
            where ${ssfDelivery.streamId} = ${streamId}
              and ${ssfDelivery.sourceEventId} = ${domainEvent.id}
          )`,
        ),
      )
      .orderBy(asc(domainEvent.id))
      .limit(limit);
  }
}

export class DrizzleSsfDeliveryRepository implements SsfDeliveryRepository {
  constructor(private readonly db: Database) {}

  async enqueue(input: Parameters<SsfDeliveryRepository["enqueue"]>[0]): Promise<boolean> {
    const rows = await this.db
      .insert(ssfDelivery)
      .values({
        id: input.id,
        streamId: input.streamId,
        sourceEventId: input.sourceEventId,
        eventType: input.eventType,
        jti: input.jti,
        txn: input.txn,
        signingKid: input.signingKid,
        setToken: input.setToken,
      })
      .onConflictDoNothing()
      .returning({ id: ssfDelivery.id });
    return rows.length > 0;
  }

  async recordSigningKid(streamId: string, signingKid: string, now: Date): Promise<void> {
    await this.db
      .update(ssfStream)
      .set({ signingKid, updatedAt: now })
      .where(eq(ssfStream.id, streamId));
  }

  claimDue(input: Parameters<SsfDeliveryRepository["claimDue"]>[0]) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(ssfDelivery)
        .set({ status: "pending", claimedAt: null, updatedAt: input.now })
        .where(
          and(
            eq(ssfDelivery.status, "delivering"),
            sql`${ssfDelivery.claimedAt} < ${input.staleBefore}`,
          ),
        );
      const result = await tx.execute<{
        id: string;
        endpoint: string;
        set_token: string;
        attempt_count: number;
      }>(sql`
        with due as (
          select d.id from ssf_delivery d join ssf_stream s on s.id = d.stream_id
          where d.status = 'pending' and d.next_attempt_at <= ${input.now}
            and (s.status = 'enabled' or d.event_type = ${SSF_VERIFICATION_EVENT})
          order by d.next_attempt_at, d.created_at
          limit ${input.batchSize} for update of d skip locked
        )
        update ssf_delivery d set status = 'delivering', claimed_at = ${input.now},
          updated_at = ${input.now}
        from due, ssf_stream s
        where d.id = due.id and s.id = d.stream_id
        returning d.id, s.endpoint, d.set_token, d.attempt_count
      `);
      return result.rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        setToken: row.set_token,
        attemptCount: row.attempt_count,
      }));
    });
  }

  async finalize(input: Parameters<SsfDeliveryRepository["finalize"]>[0]): Promise<void> {
    await this.db
      .update(ssfDelivery)
      .set({
        status: input.status,
        attemptCount: input.attemptCount,
        claimedAt: null,
        deliveredAt: input.deliveredAt,
        lastStatusCode: input.statusCode,
        lastError: input.errorMessage,
        nextAttemptAt: input.nextAttemptAt,
        updatedAt: input.finalizedAt,
      })
      .where(eq(ssfDelivery.id, input.id));
  }
}
