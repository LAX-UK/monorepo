import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerHc } from "@/lib/data/http/hc-server";
import { cache } from "react";
import { z } from "zod";

/** Backoff schedule for retrying transient `/users/me` failures (ms). Each entry is one retry. */
const TRANSIENT_RETRY_DELAYS_MS = [150, 400];

type AttemptResult =
  | { kind: "user"; user: SessionUser }
  | { kind: "unauthenticated" }
  | { kind: "transient"; status?: number };

const sessionUserSchema = z.custom<SessionUser>((val) => val as SessionUser);

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
 * Resolves the current session user for SSR. Returns `null` ONLY for a genuine `401`
 * (no session). Transient API failures (5xx / network / timeout) are retried with a short
 * backoff before giving up, so a brief blip — typically a rolling deploy restart — does not
 * masquerade as a logout and bounce a valid user to `/login`.
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
    // Transient failure persisted across retries (not a 401). Log so 401-vs-5xx is observable,
    // then fall back to the unauthenticated contract callers already expect.
    console.error("[auth] session lookup failed after retries (transient, not 401)", {
      status: lastStatus,
    });
    return null;
  },
);
