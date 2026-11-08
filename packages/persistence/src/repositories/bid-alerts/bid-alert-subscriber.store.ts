import type { ConsentRecord, StopReason, SubscriberRecord, SubscriberStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import { bidAlertSubscriber as t } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";

const columns = {
  id: t.id,
  product: t.product,
  email: t.email,
  subjectId: t.subjectId,
  status: t.status,
  stopReason: t.stopReason,
  requestedAt: t.requestedAt,
  confirmationSentAt: t.confirmationSentAt,
  linkVersion: t.linkVersion,
};

type Row = {
  id: string;
  product: string;
  email: string;
  subjectId: string | null;
  status: string;
  stopReason: string | null;
  requestedAt: Date;
  confirmationSentAt: Date | null;
  linkVersion: number;
};

const toRecord = (row: Row): SubscriberRecord => row as SubscriberRecord;

/** LAX Bid's subscribers. Every query names the product, so a Shop row could never be read. */
export class BidAlertSubscriberStore implements SubscriberStore {
  constructor(private readonly db: Database) {}

  async findByEmail(product: "bid" | "shop" | "art", email: string) {
    const [row] = await this.db
      .select(columns)
      .from(t)
      .where(and(eq(t.product, product), eq(t.email, email)))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async findById(id: string) {
    const [row] = await this.db.select(columns).from(t).where(eq(t.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async findBySubject(product: "bid" | "shop" | "art", subjectId: string) {
    const [row] = await this.db
      .select(columns)
      .from(t)
      .where(and(eq(t.product, product), eq(t.subjectId, subjectId)))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async savePending(
    input: ConsentRecord & { product: "bid" | "shop" | "art"; email: string; now: Date },
  ) {
    const [row] = await this.db
      .insert(t)
      .values({
        product: input.product,
        email: input.email,
        status: "pending",
        consentText: input.consentText,
        consentSource: input.consentSource,
        requestedAt: input.now,
        confirmationSentAt: input.now,
      })
      .onConflictDoUpdate({
        target: [t.product, t.email],
        set: {
          status: "pending",
          consentText: input.consentText,
          consentSource: input.consentSource,
          requestedAt: input.now,
          confirmationSentAt: input.now,
          confirmedAt: null,
          stoppedAt: null,
          stopReason: null,
          updatedAt: input.now,
        },
        // A confirmed address is left alone, even if two requests race.
        setWhere: sql`${t.status} <> 'confirmed'`,
      })
      .returning(columns);
    if (row) return toRecord(row);
    const existing = await this.findByEmail(input.product, input.email);
    if (!existing) throw new Error("alert subscriber upsert failed");
    return existing;
  }

  async saveConfirmedForAccount(
    input: ConsentRecord & {
      product: "bid" | "shop" | "art";
      email: string;
      subjectId: string;
      now: Date;
    },
  ) {
    const [row] = await this.db
      .insert(t)
      .values({
        product: input.product,
        email: input.email,
        subjectId: input.subjectId,
        status: "confirmed",
        consentText: input.consentText,
        consentSource: input.consentSource,
        requestedAt: input.now,
        confirmedAt: input.now,
      })
      .onConflictDoUpdate({
        target: [t.product, t.email],
        set: {
          subjectId: input.subjectId,
          // Consent evidence already on the row is kept; a new wording only replaces a stopped row's.
          consentText: sql`CASE WHEN ${t.status} = 'confirmed' THEN ${t.consentText} ELSE ${input.consentText} END`,
          consentSource: sql`CASE WHEN ${t.status} = 'confirmed' THEN ${t.consentSource} ELSE ${input.consentSource} END`,
          confirmedAt: sql`CASE WHEN ${t.status} = 'confirmed' THEN ${t.confirmedAt} ELSE ${input.now} END`,
          status: "confirmed",
          stoppedAt: null,
          stopReason: null,
          updatedAt: input.now,
        },
        // An address that complained stays stopped until a person at LAX lifts it.
        setWhere: sql`${t.stopReason} IS DISTINCT FROM 'complaint'`,
      })
      .returning(columns);
    if (row) return toRecord(row);
    const existing = await this.findByEmail(input.product, input.email);
    if (!existing) throw new Error("alert subscriber upsert failed");
    return existing;
  }

  async confirm(id: string, now: Date) {
    const rows = await this.db
      .update(t)
      .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
      .where(and(eq(t.id, id), eq(t.status, "pending")))
      .returning({ id: t.id });
    return rows.length > 0;
  }

  async stop(id: string, reason: StopReason, now: Date) {
    const rows = await this.db
      .update(t)
      .set({ status: "stopped", stoppedAt: now, stopReason: reason, updatedAt: now })
      .where(and(eq(t.id, id), sql`${t.status} <> 'stopped'`))
      .returning({ id: t.id });
    return rows.length > 0;
  }

  async linkAccount(id: string, subjectId: string, now: Date) {
    await this.db.update(t).set({ subjectId, updatedAt: now }).where(eq(t.id, id));
  }
}
