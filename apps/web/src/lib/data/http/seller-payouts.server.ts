import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { Payout } from "@auction/types";

export type SellerPayoutPendingPreview = {
  pendingGross: string;
  pendingPlatformFee: string;
  pendingNet: string;
  paymentCount: number;
  currency: string;
};

export type PayoutsLoadError = "unauthorized" | "forbidden" | "server_error";

export type SellerPayoutListResult =
  | { ok: true; payouts: Payout[] }
  | { ok: false; error: PayoutsLoadError };

export type SellerPayoutPreviewResult =
  | { ok: true; data: SellerPayoutPendingPreview }
  | { ok: false; error: PayoutsLoadError };

function entityHeaders(legalEntityId: string): HeadersInit {
  return { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId };
}

function classifyPayoutsError(status: number): PayoutsLoadError {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "server_error";
}

/** API JSON returns ISO strings; hydrate to `Date` for `Payout` consumers. */
function parsePayoutFromApi(raw: Payout): Payout {
  return {
    ...raw,
    periodStart: new Date(raw.periodStart),
    periodEnd: new Date(raw.periodEnd),
    processedAt: raw.processedAt ? new Date(raw.processedAt) : null,
    createdAt: new Date(raw.createdAt),
  };
}

/** `GET /payouts` with explicit `X-Legal-Entity-Id` (seller settlement list). */
export async function getServerPayoutsListForLegalEntity(
  legalEntityId: string,
): Promise<SellerPayoutListResult> {
  const res = await authedServerFetch("/payouts", {
    headers: entityHeaders(legalEntityId),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: classifyPayoutsError(res.status) };
  const body = (await res.json()) as { data: Payout[] };
  return { ok: true, payouts: body.data.map(parsePayoutFromApi) };
}

/** `GET /payouts/preview-next` with explicit `X-Legal-Entity-Id`. */
export async function getServerPayoutPreviewNextForLegalEntity(
  legalEntityId: string,
): Promise<SellerPayoutPreviewResult> {
  const res = await authedServerFetch("/payouts/preview-next", {
    headers: entityHeaders(legalEntityId),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: classifyPayoutsError(res.status) };
  const body = (await res.json()) as { data: SellerPayoutPendingPreview };
  return { ok: true, data: body.data };
}
