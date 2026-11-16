import type { AdminCheckInCandidate } from "@/lib/data/http/admin-sale-registrations.types";
import type { ActionResult } from "@/lib/forms/form-result";

/**
 * Door check-in, sent from the browser to the API through the same-origin BFF (`/api/bff/...`)
 * like the clerk console's commands. These used to be server actions: an action id belongs to
 * one build, so a panel opened before a deploy crashed into the tab's error boundary. A BFF path
 * is the same on every build. The API checks saleroom and sales access on both calls.
 *
 * Deliberately self-contained (plain same-origin `fetch`, no shared helpers), and loaded only when
 * staff first search or check someone in (`check-in.lazy.ts`), so none of it is in the
 * registrations tab's start-up JavaScript.
 */

/** When the check-in request itself does not go through. */
export const SALEROOM_CHECK_IN_TRANSPORT_COPY = {
  unreachable: "The saleroom could not be reached. Check the connection, then try again.",
  sessionExpired: "Your session has ended. Sign in again to continue.",
} as const;

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
  read: (data: Record<string, unknown>) => T,
  body?: object,
): Promise<ActionResult<T>> {
  let res: Response;
  try {
    res = await fetch(
      `/api/bff/admin/sales/${encodeURIComponent(saleId)}/registrations/${path}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
  } catch {
    return { ok: false, error: SALEROOM_CHECK_IN_TRANSPORT_COPY.unreachable };
  }
  const json = (await res.json().catch(() => null)) as {
    data?: Record<string, unknown>;
    error?: string;
    code?: string;
  } | null;
  if (res.ok) return { ok: true, data: read(json?.data ?? {}) };
  return {
    ok: false,
    error:
      res.status === 401
        ? SALEROOM_CHECK_IN_TRANSPORT_COPY.sessionExpired
        : (json?.error ?? fallback),
    status: res.status,
    ...(json?.code ? { errorCode: json.code } : {}),
  };
}

export function searchCheckInCandidates({ saleId, q }: { saleId: string; q: string }) {
  return send(
    saleId,
    `check-in-candidates?${new URLSearchParams({ q })}`,
    "Could not search clients",
    (data) => (Array.isArray(data.items) ? (data.items as AdminCheckInCandidate[]) : []),
  );
}

export function checkInBidder({ saleId, ...body }: CheckInInput) {
  return send(
    saleId,
    "check-in",
    "Check-in failed",
    // The API's own shape: `{ registrationId, paddleNumber, checkedInAt, bidLimit }`.
    (data) => data as CheckInResult,
    body,
  );
}
