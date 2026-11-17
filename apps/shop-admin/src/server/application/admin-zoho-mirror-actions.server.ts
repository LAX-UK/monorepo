"use server";

import { type ZohoMirrorCellView, presentZohoMirrorCell } from "@/server/domain/zoho-mirror.vm";
import {
  type AdminZohoMirrorStatusList,
  ZOHO_MIRROR_BATCH_LIMIT,
  ZOHO_MIRROR_ENTITIES,
  type ZohoMirrorEntity,
} from "@auction/shop-contracts";
import { fetchAdminJson } from "./load-admin-data";

/**
 * What a list's "Zoho" column shows for each of its records (Z1, Z4's batched read), keyed by id:
 * the badge, or null for a record with nothing to mirror. Asked only once the column is shown, so
 * a list with it hidden reads no ledger. A list page holds at most 100 rows, the batch limit, so
 * one read covers it. Null when the read failed: the column then stays blank, as the record's own
 * badge does, rather than claiming anything.
 */
export async function loadZohoMirrorCells(
  entity: ZohoMirrorEntity,
  ids: readonly string[],
): Promise<Record<string, ZohoMirrorCellView | null> | null> {
  if (!ZOHO_MIRROR_ENTITIES.includes(entity) || !Array.isArray(ids)) return null;
  const unique = [...new Set(ids.map(String))].slice(0, ZOHO_MIRROR_BATCH_LIMIT);
  if (unique.length === 0) return {};
  const result = await fetchAdminJson<AdminZohoMirrorStatusList>(
    `zoho-mirror/statuses?entity=${entity}&ids=${unique.map(encodeURIComponent).join(",")}`,
  );
  if (result.status !== "ok") return null;
  const cells: Record<string, ZohoMirrorCellView | null> = {};
  for (const status of result.data.items) cells[status.id] = presentZohoMirrorCell(status);
  return cells;
}
