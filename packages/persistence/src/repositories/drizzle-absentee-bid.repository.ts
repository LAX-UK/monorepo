import type { Database } from "@auction/db";
import { absenteeBid } from "@auction/db/schema";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { IAbsenteeBidRepository } from "../interfaces/absentee-bid.repository.js";

export class DrizzleAbsenteeBidRepository implements IAbsenteeBidRepository {
  constructor(private readonly db: Database) {}

  async insertScheduled(input: {
    lotId: string;
    userId: string;
    buyerLegalEntityId: string;
    maxAmount: string;
  }): Promise<{ id: string } | null> {
    const [row] = await this.db
      .insert(absenteeBid)
      .values({
        lotId: input.lotId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        maxAmount: input.maxAmount,
        status: "scheduled",
      })
      .returning({ id: absenteeBid.id });
    return row ?? null;
  }

  async expireStaleExecutingLeases(cutoff: Date): Promise<void> {
    await this.db
      .update(absenteeBid)
      .set({
        status: "lost",
        cancellationReason: "executing_lease_expired",
        executingAt: null,
      })
      .where(
        and(
          eq(absenteeBid.status, "executing"),
          or(isNull(absenteeBid.executingAt), lt(absenteeBid.executingAt, cutoff)),
        ),
      );
  }

  async listStaleExecuting(cutoff: Date) {
    return this.db
      .select()
      .from(absenteeBid)
      .where(
        and(
          eq(absenteeBid.status, "executing"),
          or(isNull(absenteeBid.executingAt), lt(absenteeBid.executingAt, cutoff)),
        ),
      );
  }

  async listScheduledForLot(lotId: string) {
    return this.db
      .select()
      .from(absenteeBid)
      .where(and(eq(absenteeBid.lotId, lotId), eq(absenteeBid.status, "scheduled")))
      .orderBy(desc(absenteeBid.maxAmount));
  }

  async markVoided(id: string, cancellationReason: string): Promise<void> {
    await this.db
      .update(absenteeBid)
      .set({ status: "voided", cancellationReason })
      .where(eq(absenteeBid.id, id));
  }

  async markLost(id: string, cancellationReason?: string): Promise<void> {
    await this.db
      .update(absenteeBid)
      .set({
        status: "lost",
        ...(cancellationReason ? { cancellationReason } : {}),
        executingAt: null,
      })
      .where(eq(absenteeBid.id, id));
  }

  async claimExecuting(id: string, executingAt: Date): Promise<boolean> {
    const [claimed] = await this.db
      .update(absenteeBid)
      .set({ status: "executing", executingAt })
      .where(and(eq(absenteeBid.id, id), eq(absenteeBid.status, "scheduled")))
      .returning({ id: absenteeBid.id });
    return claimed != null;
  }

  async markExecuted(id: string, executedBidId: string): Promise<void> {
    await this.db
      .update(absenteeBid)
      .set({
        status: "executed",
        executedBidId,
        executingAt: null,
      })
      .where(eq(absenteeBid.id, id));
  }
}
