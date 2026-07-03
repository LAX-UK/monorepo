import type { LotLifecycleSnapshotRow } from "../lot-lifecycle-snapshot.types.js";

export interface ILotLifecycleSnapshotReader {
  getSnapshot(lotId: string): Promise<LotLifecycleSnapshotRow | null>;

  getSnapshotsForLots(lotIds: string[]): Promise<Map<string, LotLifecycleSnapshotRow>>;
}
