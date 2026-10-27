import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";

/** What the API restores a browser to; see `RememberedAccountService` in the API. */
export type RestoredAccount = {
  accountId: string;
  lostOrganisation: { id: string; displayName: string } | null;
};

export type RecordKind = "consignment" | "purchase";

export type RecordAccount =
  | { kind: "ok"; legalEntityId: string }
  | { kind: "no_access" }
  | { kind: "not_found" };

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

/** The account this browser should use, given the one it used last (`null` on a new device). */
export async function restoreAccount(candidateId: string | null): Promise<RestoredAccount | null> {
  try {
    const res = await authedServerFetch("/legal-entities/me/remembered-account/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: RestoredAccount };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** Which of the person's accounts owns a consignment or purchase. */
export async function findRecordAccount(kind: RecordKind, id: string): Promise<RecordAccount> {
  const res = await authedServerFetch(`/legal-entities/me/record-account/${kind}/${id}`, {
    cache: "no-store",
  });
  if (res.status === 403) return { kind: "no_access" };
  if (!res.ok) return { kind: "not_found" };
  const body = (await res.json()) as { data?: { legalEntityId?: string } };
  const legalEntityId = body.data?.legalEntityId;
  return legalEntityId ? { kind: "ok", legalEntityId } : { kind: "not_found" };
}
