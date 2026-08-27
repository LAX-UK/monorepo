import "server-only";

import { SessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import type { SessionUser } from "@/lib/data/contracts";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerHc } from "@/lib/data/http/hc-server";
import { sessionUserSchema } from "@/lib/data/http/session.schema";
import { cache } from "react";

/** Backoff schedule for retrying transient `/users/me` failures (ms). Each entry is one retry. */
const TRANSIENT_RETRY_DELAYS_MS = [150, 400];

type AttemptResult =
  | { kind: "user"; user: SessionUser }
  | { kind: "unauthenticated" }
  | { kind: "transient"; status?: number };

async function fetchSessionUserOnce(): Promise<AttemptResult> {
  try {
    const client = await getServerHc();
    const res = await client.users.me.$get();
    // A genuine "no session" — the only signal that should log a user out.
    if (res.status === 401) return { kind: "unauthenticated" };
    // Any other non-2xx (5xx / 502 / 503 / 504 during deploys or overload) is a transient
    // backend blip, NOT a logout. Collapsing it into `null` would bounce a still-valid user
    // to `/login` via the dashboard/admin guards.
    if (!res.ok) return { kind: "transient", status: res.status };
    const body = await readJsonBody(res);
    return {
      kind: "user",
      user: readDataEnvelope(body, sessionUserSchema, "GET /users/me"),
    };
  } catch {
    // Network error / timeout reaching the API (e.g. rolling restart) — transient.
    return { kind: "transient" };
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves the current session user for SSR. Returns `null` only for `401`.
 * Transient failures (429 / 5xx / network) retry, then throw so callers do
 * not treat a blip as logout.
 */
export const getServerSessionUser = cache(
  async function getServerSessionUser(): Promise<SessionUser | null> {
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
      const result = await fetchSessionUserOnce();
      if (result.kind === "user") return result.user;
      if (result.kind === "unauthenticated") return null;
      lastStatus = result.status;
      const nextDelay = TRANSIENT_RETRY_DELAYS_MS[attempt];
      if (nextDelay !== undefined) await delay(nextDelay);
    }
    // Transient failure persisted. Returning null would look like a 401 and
    // send a still-valid session to /login (which then strips cookies).
    throw new SessionLookupTransientError(lastStatus);
  },
);
