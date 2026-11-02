import type { Database } from "@auction/db";
import { visitorSaleAlertSubscriber } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  IVisitorSaleAlertRepository,
  VisitorSaleAlertRecord,
} from "../interfaces/visitor-sale-alert.repository.js";

const columns = {
  id: visitorSaleAlertSubscriber.id,
  email: visitorSaleAlertSubscriber.email,
  status: visitorSaleAlertSubscriber.status,
  requestedAt: visitorSaleAlertSubscriber.requestedAt,
  confirmationSentAt: visitorSaleAlertSubscriber.confirmationSentAt,
  linkedUserId: visitorSaleAlertSubscriber.linkedUserId,
};

export class DrizzleVisitorSaleAlertRepository implements IVisitorSaleAlertRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<VisitorSaleAlertRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(visitorSaleAlertSubscriber)
      .where(eq(visitorSaleAlertSubscriber.email, email))
      .limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<VisitorSaleAlertRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(visitorSaleAlertSubscriber)
      .where(eq(visitorSaleAlertSubscriber.id, id))
      .limit(1);
    return row ?? null;
  }

  async savePending(input: {
    email: string;
    consentText: string;
    consentSource: string;
    now: Date;
  }): Promise<VisitorSaleAlertRecord> {
    const [row] = await this.db
      .insert(visitorSaleAlertSubscriber)
      .values({
        email: input.email,
        status: "pending",
        consentText: input.consentText,
        consentSource: input.consentSource,
        requestedAt: input.now,
        confirmationSentAt: input.now,
      })
      .onConflictDoUpdate({
        target: visitorSaleAlertSubscriber.email,
        set: {
          status: "pending",
          consentText: input.consentText,
          consentSource: input.consentSource,
          requestedAt: input.now,
          confirmationSentAt: input.now,
          confirmedAt: null,
          unsubscribedAt: null,
          updatedAt: input.now,
        },
        // A confirmed address is left alone, even if two requests race.
        setWhere: sql`${visitorSaleAlertSubscriber.status} <> 'confirmed'`,
      })
      .returning(columns);
    if (row) return row;
    const existing = await this.findByEmail(input.email);
    if (!existing) throw new Error("visitor sale alert upsert failed");
    return existing;
  }

  async confirm(id: string, now: Date): Promise<boolean> {
    const rows = await this.db
      .update(visitorSaleAlertSubscriber)
      .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
      .where(
        and(
          eq(visitorSaleAlertSubscriber.id, id),
          eq(visitorSaleAlertSubscriber.status, "pending"),
        ),
      )
      .returning({ id: visitorSaleAlertSubscriber.id });
    return rows.length > 0;
  }

  async unsubscribe(id: string, now: Date): Promise<void> {
    await this.db
      .update(visitorSaleAlertSubscriber)
      .set({ status: "unsubscribed", unsubscribedAt: now, updatedAt: now })
      .where(
        and(
          eq(visitorSaleAlertSubscriber.id, id),
          sql`${visitorSaleAlertSubscriber.status} <> 'unsubscribed'`,
        ),
      );
  }

  async linkUser(id: string, userId: string, now: Date): Promise<void> {
    await this.db
      .update(visitorSaleAlertSubscriber)
      .set({ linkedUserId: userId, updatedAt: now })
      .where(eq(visitorSaleAlertSubscriber.id, id));
  }
}
