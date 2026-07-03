import type { LotLifecycleTimelineEventRow } from "../lot-lifecycle-snapshot.types.js";

export interface ILotLifecycleTimelineReader {
  fetchTimelineEvents(
    lotId: string,
    limit: number,
    offset: number,
  ): Promise<LotLifecycleTimelineEventRow[]>;

  fetchSaleTitlesByIds(saleIds: readonly string[]): Promise<Map<string, string>>;
}
