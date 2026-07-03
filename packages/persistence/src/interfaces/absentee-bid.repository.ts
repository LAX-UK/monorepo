import type { absenteeBid } from "@auction/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type AbsenteeBidRow = InferSelectModel<typeof absenteeBid>;

export interface IAbsenteeBidRepository {
  insertScheduled(input: {
    lotId: string;
    userId: string;
    buyerLegalEntityId: string;
    maxAmount: string;
  }): Promise<{ id: string } | null>;
  expireStaleExecutingLeases(cutoff: Date): Promise<void>;
  listScheduledForLot(lotId: string): Promise<AbsenteeBidRow[]>;
  markVoided(id: string, cancellationReason: string): Promise<void>;
  markLost(id: string, cancellationReason?: string): Promise<void>;
  claimExecuting(id: string, executingAt: Date): Promise<boolean>;
  markExecuted(id: string, executedBidId: string): Promise<void>;
}
