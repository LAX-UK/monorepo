import type { ArchiveEndedAggregateFilter, ListLotsFilter } from "@auction/persistence";
import type { Lot } from "@auction/types";
import type { LotServiceDeps } from "./lot-types.js";

export function clampLotBidsLimitQuery(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "50", 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
}

export async function getById(deps: LotServiceDeps, id: string): Promise<Lot | null> {
  return deps.lotRepo.findById(id);
}

export async function list(deps: LotServiceDeps, filter: ListLotsFilter): Promise<Lot[]> {
  return deps.lotRepo.list(filter);
}

export function countMatching(
  deps: LotServiceDeps,
  filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">,
): Promise<number> {
  return deps.lotRepo.countMatching(filter);
}

export function archiveEndedSummary(deps: LotServiceDeps, filter: ArchiveEndedAggregateFilter) {
  return deps.lotRepo.sumEndedHammer(filter);
}
