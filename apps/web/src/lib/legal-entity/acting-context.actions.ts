"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeActingContextCookie } from "@auction/types";
import { z } from "zod";
import { ACTING_LEGAL_ENTITY_COOKIE } from "./client-acting-context";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const IMPERSONATION_COOKIE_MAX_AGE = 60 * 60 * 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readImpersonationSnapshot(): Promise<{ sessionId: string; legalEntityId: string } | null> {
  const jar = await cookies();
  const raw = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  if (!raw) return null;
  let decoded;
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
    redirect(
      recordedRemote ? "/admin" : "/admin?impersonation_end_warning=1",
    );
  }

  redirect("/admin");
}

export async function startAdminImpersonation(
  legalEntityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authedServerFetch("/admin/impersonation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ legalEntityId }),
  });
  if (res.status === 400) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error ?? "bad_request" };
  }
  if (!res.ok) {
    return { ok: false, error: res.status === 404 ? "not_found" : "unknown" };
  }
  const body = (await res.json()) as { data?: { actingCookie?: string } };
  const actingCookie = body.data?.actingCookie;
  if (!actingCookie) {
    return { ok: false, error: "unknown" };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = legalEntityId.trim();
  const parsed = z.string().uuid().safeParse(trimmed);
  if (!parsed.success) {
    return { ok: false, error: "bad_request" };
  }

  const lookup = await authedServerFetch(
    `/admin/impersonation/lookup?legalEntityId=${encodeURIComponent(trimmed)}`,
    { cache: "no-store" },
  );
  if (lookup.status === 404) {
    return { ok: false, error: "not_found" };
  }
  if (!lookup.ok) {
    return { ok: false, error: "unknown" };
  }

  const started = await startAdminImpersonation(trimmed);
  if (!started.ok) {
    return started;
  }
  redirect("/admin");
}
