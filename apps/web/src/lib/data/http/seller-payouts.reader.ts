import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import {
  payoutFromApiSchema,
  sellerPayoutPendingPreviewSchema,
} from "@/lib/data/http/seller-payouts.schema";
import type {
  PayoutsLoadError,
  SellerPayoutListResult,
  SellerPayoutPreviewResult,
} from "@/lib/data/http/seller-payouts.types";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";

export type {
  PayoutsLoadError,
  SellerPayoutListResult,
  SellerPayoutPendingPreview,
  SellerPayoutPreviewResult,
} from "@/lib/data/http/seller-payouts.types";

function entityHeaders(legalEntityId: string): HeadersInit {
  return { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId };
}

function classifyPayoutsError(status: number): PayoutsLoadError {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "server_error";
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
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, payoutFromApiSchema, "GET /payouts");
  return { ok: true, payouts: rows };
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
  const body = await readJsonBody(res);
  return {
    ok: true,
    data: readDataEnvelope(body, sellerPayoutPendingPreviewSchema, "GET /payouts/preview-next"),
  };
}
