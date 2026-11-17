import type { Database } from "@auction/db";
import type { saleroomEvent, saleroomSession } from "@auction/db/schema";

export type SaleroomSessionRow = typeof saleroomSession.$inferSelect;
export type SaleroomEventRow = typeof saleroomEvent.$inferSelect;

export type SaleroomSessionStatusSummary = {
  saleId: string;
  status: SaleroomSessionRow["status"];
  currentLotId: string | null;
};

export type SaleroomEventKind =
  | "opened"
  | "advanced_to_lot"
  | "hammer"
  | "no_sale"
  | "paused"
  | "resumed"
  | "closed";

export interface ISaleroomSessionRepository {
  findBySaleId(saleId: string): Promise<SaleroomSessionRow | null>;
  findStatusSummariesBySaleIds(saleIds: readonly string[]): Promise<SaleroomSessionStatusSummary[]>;
  upsertPending(saleId: string, clerkUserId: string): Promise<SaleroomSessionRow>;
  markLive(input: {
    sessionId: string;
    clerkUserId: string;
    startedAt: Date;
  }): Promise<void>;
  markPaused(sessionId: string): Promise<void>;
  markResumed(sessionId: string): Promise<void>;
  setCurrentLot(sessionId: string, lotId: string): Promise<void>;
  /**
   * Takes `lotId` off the block only if it is still the session's current lot (compare-and-clear).
   * Pass the lot outcome transaction as `tx` so the clear commits with the outcome write. An advance
   * that already put another lot on the block is left alone: returns `{ cleared: false }`.
   */
  clearCurrentLotIfCurrent(
    input: { sessionId: string; lotId: string },
    tx?: Database,
  ): Promise<{ cleared: boolean }>;
  markEnded(sessionId: string, endedAt: Date): Promise<void>;
  clearDisplayOverlay(saleId: string): Promise<{ cleared: boolean }>;
  appendEvent(input: {
    sessionId: string;
    kind: SaleroomEventKind;
    payload: Record<string, unknown>;
    actorUserId: string;
  }): Promise<void>;
  listRecentEvents(sessionId: string, limit?: number): Promise<SaleroomEventRow[]>;
}
