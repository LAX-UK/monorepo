import type { SaleroomDisplaySnapshot } from "@auction/types";

export interface IDisplaySnapshotReader {
  getSnapshot(saleId: string): Promise<SaleroomDisplaySnapshot | null>;
}
