import "server-only";

import type { ListLotsParams } from "@/lib/data/contracts";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot } from "@/lib/data/http/parse";
import type { Lot } from "@auction/types";

/** Matches {@link listLotsQuerySchema} max on the API. */
const ADMIN_LOT_LIST_MAX_LIMIT = 100;

export async function getAdminLotList(params: ListLotsParams = {}): Promise<
  Array<
    Lot & {
      lifecycleSummary?: AdminLotLifecycleSummary;
      connectRequired?: boolean;
    }
  >
> {
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
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map((raw) => {
    const o = raw as Record<string, unknown>;
    const lot = parseLot(raw);
    const ls = o.lifecycleSummary as Record<string, unknown> | undefined;
    const deleteEligibility = parseLotDeleteEligibility(o.deleteEligibility);
    const connectRequired =
      o.connectRequired === true ? true : o.connectRequired === false ? false : undefined;
    const lifecycleSummary =
      ls && typeof ls.lastEventType === "string" && typeof ls.lastEventAt === "string"
        ? {
            lastEventType: ls.lastEventType,
            lastEventAt: ls.lastEventAt,
            returnCount: Number(ls.returnCount ?? 0),
          }
        : undefined;
    return {
      ...lot,
      ...(lifecycleSummary ? { lifecycleSummary } : {}),
      ...(deleteEligibility != null ? { deleteEligibility } : {}),
      ...(connectRequired !== undefined ? { connectRequired } : {}),
    };
  });
}

export type AdminLotLifecycleSummary = {
  lastEventType: string;
  lastEventAt: string;
  returnCount: number;
};

export type LotDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  blockers: string[];
};

function parseLotDeleteEligibility(raw: unknown): LotDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blockers = Array.isArray(o.blockers) ? o.blockers.map(String) : [];
  return {
    canDelete: o.canDelete === true,
    confirmationPhrase:
      o.confirmationPhrase == null || o.confirmationPhrase === ""
        ? null
        : String(o.confirmationPhrase),
    blockers,
  };
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
  const body = (await res.json()) as { data: unknown };
  const data = body.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const deleteEligibility = parseLotDeleteEligibility(record.deleteEligibility);
  const { deleteEligibility: _omit, ...lotRaw } = record;
  return {
    auction: parseLot(lotRaw),
    deleteEligibility,
  };
}

export type AdminLotPickerRow = {
  id: string;
  title: string;
  lifecycle: {
    kind: "new_draft" | "returned";
    returnedAt: string | null;
    lastSaleId: string | null;
    lastSaleName: string | null;
    returnCount: number;
  };
};

export class AdminLotBrowseError extends Error {
  readonly status: number;

  constructor(status: number) {
    const hint = status === 404 ? " (browse endpoint missing — restart/rebuild API)" : "";
    super(`Failed to browse lots: ${status}${hint}`);
    this.name = "AdminLotBrowseError";
    this.status = status;
  }
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
  const body = (await res.json()) as { data: AdminLotPickerRow[]; total: number };
  return { rows: body.data, total: body.total };
}

export type AdminLotLifecyclePayload = {
  snapshot: {
    currentStatus: string;
    lastEventType: string;
    lastEventAt: string;
    lastSaleId: string | null;
    returnCount: number;
  } | null;
  events: {
    eventType: string;
    occurredAt: string;
    saleTitle?: string | null;
  }[];
};

export async function getAdminLotLifecycle(lotId: string): Promise<AdminLotLifecyclePayload> {
  const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/lifecycle`);
  if (!res.ok) throw new Error(`Failed to load lot lifecycle: ${res.status}`);
  const body = (await res.json()) as { data: AdminLotLifecyclePayload };
  return body.data;
}

export type LotArtistBackfillReviewTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type LotWithdrawalRequestTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export async function getLotWithdrawalRequests(): Promise<LotWithdrawalRequestTask[]> {
  const res = await authedServerFetch("/admin/lots/withdrawal-requests");
  if (!res.ok) throw new Error(`Failed to load withdrawal requests: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    kind: String(row.kind ?? ""),
    status: String(row.status ?? ""),
    targetLotId: row.targetLotId == null ? null : String(row.targetLotId),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.createdAt ?? "")),
  }));
}

export async function getLotArtistBackfillReviewTasks(): Promise<LotArtistBackfillReviewTask[]> {
  const res = await authedServerFetch("/admin/lots/artist-backfill-review");
  if (!res.ok) throw new Error(`Failed to load artist backfill tasks: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    kind: String(row.kind ?? ""),
    status: String(row.status ?? ""),
    targetLotId: row.targetLotId == null ? null : String(row.targetLotId),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.createdAt ?? "")),
  }));
}
