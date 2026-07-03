import type { Database } from "@auction/db";
import type { UpsertLotLifecycleSnapshotInput } from "./lot-lifecycle-snapshot.types.js";

export interface ILotLifecycleSnapshotRepository {
  forConnection(conn: Database): ILotLifecycleSnapshotRepository;

  upsertSnapshot(input: UpsertLotLifecycleSnapshotInput): Promise<void>;
}
