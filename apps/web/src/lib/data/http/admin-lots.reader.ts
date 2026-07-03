import "server-only";

import type { ListLotsParams } from "@/lib/data/contracts";
import {
  adminLotDetailEnvelopeSchema,
  adminLotLifecyclePayloadSchema,
  adminLotListRowsSchema,
  adminLotPickerRowsSchema,
  lotArtistBackfillReviewTasksSchema,
  lotWithdrawalRequestTasksSchema,
} from "@/lib/data/http/admin-lots.schema";
import {
  AdminLotBrowseError,
  type AdminLotLifecyclePayload,
  type AdminLotListRow,
  type AdminLotPickerRow,
  type LotArtistBackfillReviewTask,
  type LotDeleteEligibility,
  type LotWithdrawalRequestTask,
} from "@/lib/data/http/admin-lots.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, unwrapEnvelopeData } from "@/lib/data/http/envelope";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import type { Lot } from "@auction/types";

/** Matches {@link listLotsQuerySchema} max on the API. */
const ADMIN_LOT_LIST_MAX_LIMIT = 100;

export async function getAdminLotList(params: ListLotsParams = {}): Promise<AdminLotListRow[]> {
  const qs = new URLSearchParams(
    buildLotListQuery({
      ...params,
      resolveImages: params.resolveImages ?? false,
      limit: Math.min(params.limit ?? ADMIN_LOT_LIST_MAX_LIMIT, ADMIN_LOT_LIST_MAX_LIMIT),
      offset: params.offset ?? 0,
    }),
  );
  const res = await authedServerFetch(`/lots?${qs.toString()}`);
  if (!res.ok) {
    let detail = "";
    if (res.status === 400) {
      try {
        const j = (await res.clone().json()) as { message?: string };
        detail = j.message ? ` — ${String(j.message).slice(0, 280)}` : "";
      } catch {
        // ignore
      }
    }
    throw new Error(`Failed to load lots: ${res.status}${detail}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminLotListRowsSchema, "GET /lots");
}

export async function getAdminLotById(id: string): Promise<Lot | null> {
  const detail = await getAdminLotDetail(id);
  return detail?.auction ?? null;
}

export async function getAdminLotDetail(id: string): Promise<{
  auction: Lot;
  deleteEligibility: LotDeleteEligibility | null;
} | null> {
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load lot: ${res.status}`);
  }
  const body = await readJsonBody(res);
  const unwrapped = unwrapEnvelopeData(body);
  if (!unwrapped || typeof unwrapped !== "object") return null;
  return adminLotDetailEnvelopeSchema.parse(unwrapped);
}

export async function getAdminLotBrowse(params: {
  q?: string;
  sellerLegalEntityId?: string;
  categoryIds?: string[];
  artistId?: string;
  state?: "available" | "returned" | "all";
  excludeSaleId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminLotPickerRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.sellerLegalEntityId) qs.set("sellerLegalEntityId", params.sellerLegalEntityId);
  if (params.categoryIds?.length) qs.set("categoryIds", params.categoryIds.join(","));
  if (params.artistId) qs.set("artistId", params.artistId);
  if (params.state) qs.set("state", params.state);
  if (params.excludeSaleId) qs.set("excludeSaleId", params.excludeSaleId);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/lots/browse?${qs.toString()}`);
  if (!res.ok) throw new AdminLotBrowseError(res.status);
  const body = await readJsonBody(res);
  const rows = readDataEnvelope(body, adminLotPickerRowsSchema, "GET /admin/lots/browse");
  const topLevelTotal = (body as { total?: unknown }).total;
  const total =
    typeof topLevelTotal === "number" || typeof topLevelTotal === "string"
      ? Number(topLevelTotal)
      : rows.length;
  return { rows, total };
}

export async function getAdminLotLifecycle(lotId: string): Promise<AdminLotLifecyclePayload> {
  const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/lifecycle`);
  if (!res.ok) throw new Error(`Failed to load lot lifecycle: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminLotLifecyclePayloadSchema,
    `GET /admin/lots/${lotId}/lifecycle`,
  );
}

export async function getLotWithdrawalRequests(): Promise<LotWithdrawalRequestTask[]> {
  const res = await authedServerFetch("/admin/lots/withdrawal-requests");
  if (!res.ok) throw new Error(`Failed to load withdrawal requests: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    lotWithdrawalRequestTasksSchema,
    "GET /admin/lots/withdrawal-requests",
  );
}

export async function getLotArtistBackfillReviewTasks(): Promise<LotArtistBackfillReviewTask[]> {
  const res = await authedServerFetch("/admin/lots/artist-backfill-review");
  if (!res.ok) throw new Error(`Failed to load artist backfill tasks: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    lotArtistBackfillReviewTasksSchema,
    "GET /admin/lots/artist-backfill-review",
  );
}

export { AdminLotBrowseError };
