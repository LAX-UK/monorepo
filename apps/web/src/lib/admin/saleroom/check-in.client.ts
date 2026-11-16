import type { AdminCheckInCandidate } from "@/lib/data/http/admin-sale-registrations.types";
import type { ActionResult } from "@/lib/forms/form-result";

/**
 * Door check-in, sent from the browser to the API through the same-origin BFF (`/api/bff/...`)
 * like the clerk console's commands. These used to be server actions: an action id belongs to
 * one build, so a panel opened before a deploy crashed into the tab's error boundary. A BFF path
 * is the same on every build. The API checks saleroom and sales access on both calls.
 *
 * Kept as small as the server-action stubs it replaced (it ships in the registrations tab's
 * start-up JavaScript): one plain same-origin `fetch`, no shared helpers and no copy of its own.
 * A request that never lands, or a refusal without an API message, reports the caller's fallback;
 * the panel maps refusal codes to its own copy.
 */

export type CheckInInput = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  assignPaddle: boolean;
  bidLimit?: number;
  paddleNumber?: number;
};

export type CheckInResult = {
  registrationId: string;
  paddleNumber: number | null;
  checkedInAt: string;
};

async function send<T>(
  saleId: string,
  path: string,
  fallback: string,
  body?: object,
): Promise<ActionResult<T>> {
  const res = await fetch(
    `/api/bff/admin/sales/${encodeURIComponent(saleId)}/registrations/${path}`,
    body && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ).catch(() => null);
  const json = await res?.json().catch(() => null);
  // An absent code stays `undefined` rather than being spread out: fewer bytes, same reading.
  // No caller reads the HTTP status, so it is not returned.
  return (
    res?.ok
      ? { ok: true, data: json?.data }
      : { ok: false, error: json?.error ?? fallback, errorCode: json?.code }
  ) as ActionResult<T>;
}

export function searchCheckInCandidates({ saleId, q }: { saleId: string; q: string }) {
  return send<{ items?: AdminCheckInCandidate[] }>(
    saleId,
    `check-in-candidates?${new URLSearchParams({ q })}`,
    "Could not search clients",
  );
}

export function checkInBidder({ saleId, ...body }: CheckInInput) {
  // The API's own shape: `{ registrationId, paddleNumber, checkedInAt, bidLimit }`.
  return send<CheckInResult>(saleId, "check-in", "Check-in failed", body);
}
