import type { Database } from "@auction/db";
import { deliveryQuote } from "@auction/db/schema";
import type { DeliveryQuoteStatus } from "@auction/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  DeliveryQuoteRow,
  DeliveryQuoteWrite,
  IDeliveryQuoteRepository,
} from "../interfaces/workspace-buying.readers.js";

export function mapDeliveryQuoteRow(row: typeof deliveryQuote.$inferSelect): DeliveryQuoteRow {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    status: row.status as DeliveryQuoteStatus,
    destination: row.destination,
    amount: row.amount,
    currency: row.currency,
    quoteNote: row.quoteNote,
    requestedByUserId: row.requestedByUserId,
    requestedAt: row.requestedAt,
    quotedAt: row.quotedAt,
    decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt,
  };
}

/** Postgres unique violation: a live quote already exists for the lot and account. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.code;
  const causeCode = (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

export class DrizzleDeliveryQuoteRepository implements IDeliveryQuoteRepository {
  constructor(private readonly db: Database) {}

  async findLatest(lotId: string, buyerLegalEntityId: string): Promise<DeliveryQuoteRow | null> {
    const [row] = await this.db
      .select()
      .from(deliveryQuote)
      .where(
        and(
          eq(deliveryQuote.lotId, lotId),
          eq(deliveryQuote.buyerLegalEntityId, buyerLegalEntityId),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${deliveryQuote.status} = 'withdrawn' THEN 1 ELSE 0 END`,
        desc(deliveryQuote.requestedAt),
      )
      .limit(1);
    return row ? mapDeliveryQuoteRow(row) : null;
  }

  async insertRequested(input: {
    lotId: string;
    buyerLegalEntityId: string;
    destination: string;
    currency: string;
    requestedByUserId: string;
  }): Promise<DeliveryQuoteRow | null> {
    try {
      const [row] = await this.db
        .insert(deliveryQuote)
        .values({ ...input, status: "requested" })
        .returning();
      return row ? mapDeliveryQuoteRow(row) : null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async transition(
    id: string,
    from: DeliveryQuoteStatus,
    write: DeliveryQuoteWrite,
  ): Promise<DeliveryQuoteRow | null> {
    const now = new Date();
    const byStaff = write.status === "quoted";
    const [row] = await this.db
      .update(deliveryQuote)
      .set({
        status: write.status,
        updatedAt: now,
        ...(byStaff
          ? {
              quotedByUserId: write.actorUserId,
              quotedAt: now,
              ...(write.amount !== undefined ? { amount: write.amount } : {}),
              ...(write.quoteNote !== undefined ? { quoteNote: write.quoteNote } : {}),
            }
          : { decidedByUserId: write.actorUserId, decidedAt: now }),
      })
      .where(and(eq(deliveryQuote.id, id), eq(deliveryQuote.status, from)))
      .returning();
    return row ? mapDeliveryQuoteRow(row) : null;
  }
}
