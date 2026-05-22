import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";

function queueLotCount(upNext: LotQueueCardVM | null, queue: LotQueueCardVM[]): number {
  return (upNext ? 1 : 0) + queue.length;
}

/** Whether the sale queue sidebar should occupy the left grid column. */
export function shouldShowLotQueueSidebar(
  upNext: LotQueueCardVM | null,
  queue: LotQueueCardVM[],
  isSaleQueueLoading: boolean,
): boolean {
  return isSaleQueueLoading || queueLotCount(upNext, queue) > 0;
}
