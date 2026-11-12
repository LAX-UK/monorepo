import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { RecordOwner } from "./account-hops";

/** What the API restores a browser to; see `RememberedAccountService` in the API. */
export type RestoredAccount = {
  accountId: string;
  lostOrganisation: { id: string; displayName: string } | null;
};

/** The API's choice, or `unavailable` when it could not answer (never a guess). */
export type RestoreAnswer = { ok: true; restored: RestoredAccount } | { ok: false };

export type RecordKind = "consignment" | "purchase" | "reoffer";

/**
 * Saves the account the person now uses, on their profile, so other devices open in it. Best
 * effort: the switch itself has already happened in this browser.
 */
export async function rememberAccount(legalEntityId: string): Promise<boolean> {
  try {
    const res = await authedServerFetch("/legal-entities/me/remembered-account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalEntityId }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sends one request to the API; how the caller is authenticated is up to the sender. */
export type ApiSender = (path: string, init: RequestInit) => Promise<Response>;

/** The account this browser should use, asked through `send` (`null` candidate on a new device). */
export async function restoreAccountVia(
  send: ApiSender,
  candidateId: string | null,
): Promise<RestoreAnswer> {
  try {
    const res = await send("/legal-entities/me/remembered-account/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { data?: RestoredAccount };
    return body.data?.accountId ? { ok: true, restored: body.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** The account this browser should use, for the signed-in request being served. */
export function restoreAccount(candidateId: string | null): Promise<RestoreAnswer> {
  return restoreAccountVia(authedServerFetch, candidateId);
}

/**
 * Which of the person's accounts owns a consignment or purchase. Only a 404 means the record is
 * not there; a 429, a 5xx or an unreachable API is `unavailable`, so the page shows the retry
 * state instead of telling the person their record does not exist.
 */
export async function findRecordAccount(kind: RecordKind, id: string): Promise<RecordOwner> {
  let res: Response;
  try {
    res = await authedServerFetch(`/legal-entities/me/record-account/${kind}/${id}`, {
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (res.status === 404) return { kind: "not_found" };
  if (res.status === 403) return { kind: "no_access" };
  if (!res.ok) return { kind: "unavailable" };
  const body = (await res.json().catch(() => null)) as {
    data?: { legalEntityId?: string };
  } | null;
  const legalEntityId = body?.data?.legalEntityId;
  return legalEntityId ? { kind: "ok", legalEntityId } : { kind: "unavailable" };
}
