import {
  DEFAULT_DELIVERY_REGIONS,
  DEFAULT_EXPORT_RESTRICTED_COUNTRIES,
  type DeliveryRegion,
} from "@auction/shop-domain";
import type {
  DeliveryRegionsState,
  DeliveryRegionsTx,
} from "../application/delivery-regions/delivery-regions.ports.js";
import { createDeliveryRegionsService } from "../application/delivery-regions/delivery-regions.service.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";

/**
 * The delivery settings over one in-memory store: the seeded regions and countries, the audit
 * trail and replayable commands. The real service runs on top, so tests exercise its rules.
 */
export function createInMemoryDeliveryRegions(options: { now?: Date } = {}) {
  let regions: DeliveryRegion[] = DEFAULT_DELIVERY_REGIONS.map((region) => ({ ...region }));
  let restricted: string[] = [...DEFAULT_EXPORT_RESTRICTED_COUNTRIES].sort();
  const audit: ShopAdminAuditRecord[] = [];
  const saves: { id: string; actorSubjectId: string; at: Date }[] = [];
  const completed = new Map<string, unknown>();
  let locks = 0;

  const read = async (): Promise<DeliveryRegionsState> => ({
    regions: regions.map((region) => ({ ...region })),
    restrictedCountries: [...restricted],
  });

  const tx: DeliveryRegionsTx = {
    store: {
      read,
      lock: async () => {
        locks += 1;
      },
      saveRegion: async ({ id, edit, actorSubjectId, at }) => {
        saves.push({ id, actorSubjectId, at });
        regions = regions.map((region) =>
          region.id === id
            ? {
                ...region,
                standard: edit.standard,
                specialist: edit.specialist,
                fixedPricePence: edit.fixedPricePence,
              }
            : region,
        );
      },
      replaceRestrictedCountries: async (codes) => {
        restricted = [...codes];
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
  const now = options.now ?? new Date("2026-11-10T10:00:00.000Z");
  const service = createDeliveryRegionsService({
    uow: { run: (fn) => fn(tx) },
    reader: { read },
    clock: { now: () => now },
  });
  return {
    service,
    audit,
    saves,
    read,
    locks: () => locks,
  };
}
