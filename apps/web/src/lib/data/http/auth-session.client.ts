import type { SessionUser } from "@/lib/data/contracts";

export async function fetchCurrentBffSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/bff/users/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = response.ok
    ? ((await response.json()) as { data?: SessionUser })
    : ({} as { data?: SessionUser });
  return body.data ?? null;
}

export async function requestBffLogout(): Promise<{ ok: boolean; redirectTo?: string }> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) return { ok: false };
  return { ok: true, ...((await response.json()) as { redirectTo?: string }) };
}
