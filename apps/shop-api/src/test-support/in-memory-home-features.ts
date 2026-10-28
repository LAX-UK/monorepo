import type { AdminHomeFeatures } from "@auction/shop-contracts";
import type { HomeFeatureSlot, HomeFeatureTargetFacts } from "@auction/shop-domain";
import type { HomeFeaturesTx } from "../application/home-features/home-features.ports.js";
import { createHomeFeaturesService } from "../application/home-features/home-features.service.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";
import type { ReplaceHomePlacementsCommand } from "../application/ports/storefront-curation.writer.js";

export const EMPTY_HOME_FEATURES: AdminHomeFeatures = {
  featured_prints: [],
  featured_artists: [],
  featured_categories: [],
};

/**
 * Featured on home over one in-memory store: records to choose from, the saved lists, the audit
 * trail and replayable commands. The real service runs on top, so tests exercise its rules.
 */
export function createInMemoryHomeFeatures(
  options: { saved?: Partial<Record<HomeFeatureSlot, string[]>>; now?: Date } = {},
) {
  const saved: Record<HomeFeatureSlot, string[]> = {
    featured_prints: [],
    featured_artists: [],
    featured_categories: [],
    ...options.saved,
  };
  const records = new Map<string, HomeFeatureTargetFacts>();
  const audit: ShopAdminAuditRecord[] = [];
  const writes: ReplaceHomePlacementsCommand[] = [];
  const completed = new Map<string, unknown>();
  const locks: HomeFeatureSlot[] = [];

  const tx: HomeFeaturesTx = {
    targets: {
      lockSlot: async (slot) => {
        locks.push(slot);
      },
      slotIds: async (slot) => [...saved[slot]],
      targetFacts: async (_slot, ids) =>
        ids.flatMap((id) => {
          const fact = records.get(id);
          return fact ? [fact] : [];
        }),
    },
    lists: { list: async () => EMPTY_HOME_FEATURES, searchCandidates: async () => [] },
    curation: {
      replaceHomePlacements: async (command) => {
        writes.push(command);
        for (const slot of command.slots) {
          saved[slot as HomeFeatureSlot] = command.placements
            .filter((placement) => placement.slot === slot)
            .map((placement) => placement.target.id);
        }
      },
    },
    audit: {
      append: async (record) => {
        audit.push(record);
      },
    },
    commands: {
      begin: async ({ idempotencyKey }) =>
        completed.has(idempotencyKey)
          ? { kind: "replay", result: completed.get(idempotencyKey) }
          : { kind: "started" },
      complete: async ({ idempotencyKey, result }) => {
        completed.set(idempotencyKey, result);
      },
    },
  };
  const now = options.now ?? new Date("2026-10-29T10:00:00.000Z");
  const service = createHomeFeaturesService({
    uow: { run: (fn) => fn(tx) },
    lists: tx.lists,
    clock: { now: () => now },
  });
  const add = (...facts: HomeFeatureTargetFacts[]) => {
    for (const fact of facts) records.set(fact.id, fact);
  };
  return { service, add, audit, writes, saved, locks };
}
