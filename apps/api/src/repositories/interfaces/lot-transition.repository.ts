import type { Database } from "@auction/db";
import type { LotStatus } from "@auction/types";

export interface ILotTransitionRepository {
  findLotForUpdate(tx: Database, lotId: string): Promise<Record<string, unknown> | null>;
  resetLotForInventoryReturn(tx: Database, lotId: string, fromStatus: LotStatus): Promise<void>;
}
