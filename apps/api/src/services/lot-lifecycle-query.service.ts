import type {
  ILotLifecycleSnapshotReader,
  ILotLifecycleTimelineReader,
  LotLifecycleSnapshotRow,
} from "@auction/persistence/interfaces";

export type { LotLifecycleSnapshotRow } from "@auction/persistence/interfaces";

export type LotLifecycleTimelineEvent = {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: Date;
  saleTitle?: string | null;
};

export class LotLifecycleQueryService {
  constructor(
    private readonly snapshotReader: ILotLifecycleSnapshotReader,
    private readonly timelineReader: ILotLifecycleTimelineReader,
  ) {}

  async getSnapshot(lotId: string): Promise<LotLifecycleSnapshotRow | null> {
    return this.snapshotReader.getSnapshot(lotId);
  }

  async getSnapshotsForLots(lotIds: string[]): Promise<Map<string, LotLifecycleSnapshotRow>> {
    return this.snapshotReader.getSnapshotsForLots(lotIds);
  }

  async timeline(
    lotId: string,
    opts: { limit?: number; offset?: number; includeSaleContext?: boolean } = {},
  ): Promise<LotLifecycleTimelineEvent[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const rows = await this.timelineReader.fetchTimelineEvents(lotId, limit, offset);
    const chronological = [...rows].reverse();

    if (!opts.includeSaleContext) {
      return chronological;
    }

    const saleIds = new Set<string>();
    for (const row of chronological) {
      const payload = row.payload;
      if (typeof payload.saleId === "string") saleIds.add(payload.saleId);
      if (typeof payload.lastSaleId === "string") saleIds.add(payload.lastSaleId);
      if (typeof payload.fromSaleId === "string") saleIds.add(payload.fromSaleId);
    }

    const saleTitles = await this.timelineReader.fetchSaleTitlesByIds([...saleIds]);

    return chronological.map((r) => {
      const payload = r.payload;
      const sid =
        (typeof payload.saleId === "string" ? payload.saleId : null) ??
        (typeof payload.lastSaleId === "string" ? payload.lastSaleId : null) ??
        (typeof payload.fromSaleId === "string" ? payload.fromSaleId : null);
      return {
        ...r,
        saleTitle: sid ? (saleTitles.get(sid) ?? null) : null,
      };
    });
  }
}
