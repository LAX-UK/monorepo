import type { Database } from "@auction/db";
import { saleroomDisplayPairing } from "@auction/db/schema";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type {
  ApproveDisplayPairingInput,
  DisplayPairingRow,
  IDisplayPairingRepository,
  InsertDisplayPairingInput,
} from "../services/interfaces/display-pairing-repository.js";

export class DrizzleDisplayPairingRepository implements IDisplayPairingRepository {
  constructor(private readonly db: Database) {}

  async insertPending(input: InsertDisplayPairingInput): Promise<DisplayPairingRow> {
    const [row] = await this.db
      .insert(saleroomDisplayPairing)
      .values({
        deviceCodeHash: input.deviceCodeHash,
        userCode: input.userCode,
        expiresAt: input.expiresAt,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("Expected display pairing row after insert");
    return row;
  }

  async findByDeviceCodeHash(deviceCodeHash: string): Promise<DisplayPairingRow | null> {
    const [row] = await this.db
      .select()
      .from(saleroomDisplayPairing)
      .where(eq(saleroomDisplayPairing.deviceCodeHash, deviceCodeHash))
      .limit(1);
    return row ?? null;
  }

  async findPendingByUserCode(userCode: string): Promise<DisplayPairingRow | null> {
    const [row] = await this.db
      .select()
      .from(saleroomDisplayPairing)
      .where(
        and(
          eq(saleroomDisplayPairing.userCode, userCode.toUpperCase()),
          eq(saleroomDisplayPairing.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByDisplayTokenHash(tokenHash: string): Promise<DisplayPairingRow | null> {
    const [row] = await this.db
      .select()
      .from(saleroomDisplayPairing)
      .where(
        and(
          eq(saleroomDisplayPairing.displayTokenHash, tokenHash),
          eq(saleroomDisplayPairing.status, "paired"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async approve(input: ApproveDisplayPairingInput): Promise<DisplayPairingRow | null> {
    const [row] = await this.db
      .update(saleroomDisplayPairing)
      .set({
        saleId: input.saleId,
        displayTokenHash: input.displayTokenHash,
        status: "paired",
        pairedAt: input.pairedAt,
        approvedByUserId: input.approvedByUserId,
      })
      .where(
        and(
          eq(saleroomDisplayPairing.id, input.pairingId),
          eq(saleroomDisplayPairing.status, "pending"),
        ),
      )
      .returning();
    return row ?? null;
  }

  async revoke(pairingId: string): Promise<DisplayPairingRow | null> {
    const [row] = await this.db
      .update(saleroomDisplayPairing)
      .set({ status: "revoked" })
      .where(eq(saleroomDisplayPairing.id, pairingId))
      .returning();
    return row ?? null;
  }

  async markExpired(pairingId: string): Promise<void> {
    await this.db
      .update(saleroomDisplayPairing)
      .set({ status: "expired" })
      .where(eq(saleroomDisplayPairing.id, pairingId));
  }

  async touchLastSeen(pairingId: string, at: Date): Promise<void> {
    await this.db
      .update(saleroomDisplayPairing)
      .set({ lastSeenAt: at })
      .where(eq(saleroomDisplayPairing.id, pairingId));
  }

  async listForSale(saleId: string): Promise<DisplayPairingRow[]> {
    return this.db
      .select()
      .from(saleroomDisplayPairing)
      .where(eq(saleroomDisplayPairing.saleId, saleId))
      .orderBy(desc(saleroomDisplayPairing.pairedAt));
  }

  async markExpiredStalePending(before: Date): Promise<number> {
    const rows = await this.db
      .update(saleroomDisplayPairing)
      .set({ status: "expired" })
      .where(
        and(
          eq(saleroomDisplayPairing.status, "pending"),
          lt(saleroomDisplayPairing.expiresAt, before),
        ),
      )
      .returning({ id: saleroomDisplayPairing.id });
    return rows.length;
  }

  async purgeTerminalRows(before: Date): Promise<number> {
    const rows = await this.db
      .delete(saleroomDisplayPairing)
      .where(
        and(
          inArray(saleroomDisplayPairing.status, ["expired", "revoked"]),
          lt(saleroomDisplayPairing.createdAt, before),
        ),
      )
      .returning({ id: saleroomDisplayPairing.id });
    return rows.length;
  }
}
