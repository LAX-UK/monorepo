import type { Database } from "@auction/db";
import { saleroomSession } from "@auction/db/schema";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { eq } from "drizzle-orm";
import type { ISaleroomDisplaySessionRepository } from "./interfaces/saleroom-display-session.repository.js";

export class DrizzleSaleroomDisplaySessionRepository implements ISaleroomDisplaySessionRepository {
  constructor(private readonly db: Database) {}

  async setDisplayOverlay(input: {
    saleId: string;
    overlay: SaleroomDisplayOverlay;
  }): Promise<{ updated: boolean }> {
    const now = new Date();
    const [updated] = await this.db
      .update(saleroomSession)
      .set({
        displayOverlay: input.overlay,
        displayOverlayAt: now,
        updatedAt: now,
      })
      .where(eq(saleroomSession.saleId, input.saleId))
      .returning({ id: saleroomSession.id });
    return { updated: Boolean(updated) };
  }

  async clearDisplayOverlay(saleId: string): Promise<{ updated: boolean }> {
    const [updated] = await this.db
      .update(saleroomSession)
      .set({
        displayOverlay: null,
        displayOverlayAt: null,
        updatedAt: new Date(),
      })
      .where(eq(saleroomSession.saleId, saleId))
      .returning({ id: saleroomSession.id });
    return { updated: Boolean(updated) };
  }
}
