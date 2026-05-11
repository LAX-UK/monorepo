"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { decodeActingContextCookie } from "@auction/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTING_LEGAL_ENTITY_COOKIE } from "./client-acting-context";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const IMPERSONATION_COOKIE_MAX_AGE = 60 * 60 * 5;

type ApiFailureRead = { summary: string; error?: string; code?: string };

/** Single read of error responses for debugging (status + JSON or text snippet). */
async function readApiFailure(res: Response): Promise<ApiFailureRead> {
  const status = res.status;
  const raw = await res.text();
  if (!raw.trim()) {
    return { summary: `HTTP ${status} (empty body)` };
  }
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string; code?: string };
    const err = typeof j.error === "string" ? j.error : undefined;
    const msg = typeof j.message === "string" ? j.message : undefined;
    const code = typeof j.code === "string" ? j.code : undefined;
    const human = [msg, err, code].filter(Boolean).join(" — ");
    const out: ApiFailureRead = {
      summary: human ? `HTTP ${status} — ${human}` : `HTTP ${status}`,
    };
    if (err) out.error = err;
    if (code) out.code = code;
    return out;
  } catch {
    return { summary: `HTTP ${status} — ${raw.slice(0, 240)}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readImpersonationSnapshot(): Promise<{
  sessionId: string;
  legalEntityId: string;
} | null> {
  const jar = await cookies();
  const raw = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  if (!raw) return null;
  let decoded: ReturnType<typeof decodeActingContextCookie> = null;
  try {
    decoded = decodeActingContextCookie(decodeURIComponent(raw.trim()));
  } catch {
    decoded = decodeActingContextCookie(raw.trim());
  }
  if (!decoded?.i?.sid || !decoded.e) return null;
  return { sessionId: decoded.i.sid, legalEntityId: decoded.e };
}

type SwitchResult =
  | { ok: true }
  | { ok: false; error: "not_a_member" | "unauthenticated" | "unknown" };

/** Switches the acting legal entity by setting the cookie. Validation
 * (membership) is enforced server-side: we hit `GET /legal-entities/:id`
 * which 403s if the caller is not an active member.
 * * Pass `null` to clear the cookie (falls back to personal entity).
 */
export async function switchActingLegalEntity(legalEntityId: string | null): Promise<SwitchResult> {
  const jar = await cookies();
  const cookieDomain = process.env.COOKIE_DOMAIN;

  if (legalEntityId === null) {
    jar.set(ACTING_LEGAL_ENTITY_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const res = await authedServerFetch(`/legal-entities/${legalEntityId}`, {
    cache: "no-store",
  });
  if (res.status === 401) return { ok: false, error: "unauthenticated" };
  if (res.status === 403) return { ok: false, error: "not_a_member" };
  if (!res.ok) return { ok: false, error: "unknown" };

  jar.set(ACTING_LEGAL_ENTITY_COOKIE, legalEntityId, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks the first-time acting-context tooltip as dismissed for the user. */
export async function dismissActingContextTooltip(): Promise<{ ok: boolean }> {
  const res = await authedServerFetch("/users/me/acting-context-tooltip", {
    method: "POST",
  });
  return { ok: res.ok };
}

/** end impersonation with retries; always clears cookie. */
export async function endAdminImpersonationAction(): Promise<void> {
  const snap = await readImpersonationSnapshot();

  let lastOk = false;
  if (snap) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await sleep(400 * 2 ** (attempt - 1));
      }
      const res = await authedServerFetch("/admin/impersonation/end", { method: "POST" });
      if (res.ok) {
        lastOk = true;
        break;
      }
    }
  } else {
    void (await authedServerFetch("/admin/impersonation/end", { method: "POST" }));
  }

  const jar = await cookies();
  const cookieDomain = process.env.COOKIE_DOMAIN;
  jar.set(ACTING_LEGAL_ENTITY_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  revalidatePath("/", "layout");

  if (snap && !lastOk) {
    let recordedRemote = false;
    try {
      const r = await authedServerFetch("/admin/impersonation/record-failed-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: snap.sessionId,
          legalEntityId: snap.legalEntityId,
        }),
      });
      recordedRemote = r.ok;
    } catch {
      // Best-effort: next `/admin/*` API request runs `reconcileFromAdminRequestCookie`.
    }
    redirect(recordedRemote ? "/admin" : "/admin?impersonation_end_warning=1");
  }

  redirect("/admin");
}

export async function startAdminImpersonation(
  legalEntityId: string,
): Promise<{ ok: true } | { ok: false; error: string; message?: string }> {
  let res: Response;
  try {
    res = await authedServerFetch("/admin/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalEntityId }),
    });
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "network",
      message: `Could not reach API at ${getServerApiBase()}: ${hint}`,
    };
  }
  if (res.status === 400) {
    const p = await readApiFailure(res);
    return { ok: false, error: p.error ?? "bad_request", message: p.summary };
  }
  if (!res.ok) {
    const p = await readApiFailure(res);
    if (res.status === 503 && p.code === "database_schema_incomplete") {
      return { ok: false, error: "schema_incomplete", message: p.summary };
    }
    const err =
      res.status === 401
        ? "unauthorized"
        : res.status === 403
          ? "forbidden"
          : res.status === 404
            ? "not_found"
            : "unknown";
    return { ok: false, error: err, message: p.summary };
  }
  const body = (await res.json()) as { data?: { actingCookie?: string } };
  const actingCookie = body.data?.actingCookie;
  if (!actingCookie) {
    return {
      ok: false,
      error: "missing_acting_cookie",
      message:
        "POST /admin/impersonation/start returned 200 but no data.actingCookie (check API response shape).",
    };
  }

  const jar = await cookies();
  const cookieDomain = process.env.COOKIE_DOMAIN;
  jar.set(ACTING_LEGAL_ENTITY_COOKIE, encodeURIComponent(actingCookie), {
    path: "/",
    maxAge: IMPERSONATION_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Validates UUID + entity existence (GET lookup), then starts impersonation. */
export async function startAdminImpersonationAfterLookup(
  legalEntityId: string,
): Promise<{ ok: true } | { ok: false; error: string; message?: string }> {
  const trimmed = legalEntityId.trim();
  const parsed = z.string().uuid().safeParse(trimmed);
  if (!parsed.success) {
    return { ok: false, error: "bad_request" };
  }

  let lookup: Response;
  try {
    lookup = await authedServerFetch(
      `/admin/impersonation/lookup?legalEntityId=${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "network",
      message: `Could not reach API at ${getServerApiBase()}: ${hint}`,
    };
  }

  if (lookup.status === 404) {
    return { ok: false, error: "not_found" };
  }
  if (!lookup.ok) {
    const p = await readApiFailure(lookup);
    if (lookup.status === 503 && p.code === "database_schema_incomplete") {
      return { ok: false, error: "schema_incomplete", message: p.summary };
    }
    const err =
      lookup.status === 401 ? "unauthorized" : lookup.status === 403 ? "forbidden" : "unknown";
    return { ok: false, error: err, message: p.summary };
  }

  let started: Awaited<ReturnType<typeof startAdminImpersonation>>;
  try {
    started = await startAdminImpersonation(trimmed);
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "network",
      message: `POST /admin/impersonation/start failed before response: ${hint}`,
    };
  }
  if (!started.ok) {
    return started;
  }
  redirect("/admin");
}
