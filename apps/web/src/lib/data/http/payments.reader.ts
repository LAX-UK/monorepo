import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { authedServerFetch as authedActingServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import {
  complianceGateEnvelopeSchema,
  entityWonLotSchema,
  lotFulfilmentSnapshotSchema,
  myPaymentRowSchema,
} from "@/lib/data/http/payments.schema";
import type {
  ComplianceGateStatus,
  EntityWonLot,
  LotFulfilmentSnapshot,
  MyPaymentRow,
  MyPaymentsListParams,
} from "@/lib/data/http/payments.schema";

export type {
  ComplianceGateStatus,
  EntityWonLot,
  LotFulfilmentSnapshot,
  MyPaymentRow,
  MyPaymentsListParams,
} from "@/lib/data/http/payments.schema";

/** Fetch the signed-in buyer's payments. Personal data — never cached. */
export async function getServerMyPayments(
  params: MyPaymentsListParams = {},
): Promise<MyPaymentRow[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/payments/me${suffix}`, { cache: "no-store" });
  await throwIfNotOk(res, "payments");
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, myPaymentRowSchema, "GET /payments/me");
  return rows;
}

/**
 * Buyer pre-flight compliance gate. Returns the user-level compliance status
 * without requiring an existing payment row — used by checkout + portfolio to
 * surface blockers proactively. Fails open (returns "clear") on network error
 * so the buyer can still attempt checkout and see the block on submit.
 */
export async function getServerBuyerComplianceGate(): Promise<ComplianceGateStatus> {
  try {
    const res = await authedServerFetch("/payments/me/compliance-gate", { cache: "no-store" });
    if (!res.ok) return "clear";
    const body = await readJsonBody(res);
    const parsed = readDataEnvelope(
      body,
      complianceGateEnvelopeSchema,
      "GET /payments/me/compliance-gate",
    );
    const s = parsed.status;
    return s === "aml_hold" || s === "source_of_funds_required" ? s : "clear";
  } catch {
    return "clear";
  }
}

/** Winner checkout: current fulfilment / logistics state for the lot. */
export async function getServerLotFulfilmentForWinner(
  lotId: string,
): Promise<LotFulfilmentSnapshot | null> {
  const res = await authedServerFetch(`/payments/me/lot/${encodeURIComponent(lotId)}/fulfilment`, {
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return null;
    throw new Error(`Failed to load fulfilment: ${res.status}`);
  }
  const body = await readJsonBody(res);
  const data = readDataEnvelope(
    body,
    lotFulfilmentSnapshotSchema.nullable(),
    `GET /payments/me/lot/${lotId}/fulfilment`,
  );
  return data;
}

/** Cap for the organisation's works list; the endpoint pages at 100. */
const ENTITY_LIST_LIMIT = 100;

/**
 * Works won for the organisation being acted for, whichever member bid. Sent with the acting
 * organisation header, so the API decides from the member's role whether prices are included.
 */
export async function getServerEntityWonLots(): Promise<EntityWonLot[]> {
  const res = await authedActingServerFetch(`/payments/entity/wins?limit=${ENTITY_LIST_LIMIT}`, {
    cache: "no-store",
  });
  await throwIfNotOk(res, "payments");
  const body = await readJsonBody(res);
  return readListEnvelope(body, entityWonLotSchema, "GET /payments/entity/wins").rows;
}

/** Payments billed to the organisation being acted for; the API refuses roles without finance access. */
export async function getServerEntityPayments(): Promise<MyPaymentRow[]> {
  const res = await authedActingServerFetch("/payments/entity", { cache: "no-store" });
  await throwIfNotOk(res, "payments");
  const body = await readJsonBody(res);
  return readListEnvelope(body, myPaymentRowSchema, "GET /payments/entity").rows;
}
