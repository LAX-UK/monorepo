type AuthTokenResponse = {
  ticket?: string;
};

export type SocketHandshakeAuth = Record<string, never> | { ticket: string };

/** Socket.IO receives only a one-time, 60-second connection ticket, never an OAuth token. */
export async function resolveSocketHandshakeAuth(): Promise<SocketHandshakeAuth> {
  if (typeof window === "undefined") return {};
  const ticket = await fetchSocketTicket();
  return ticket ? { ticket } : {};
}

const RETRY_DELAYS_MS = [500, 1500];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 401 means signed out: no ticket. 503 and network failures are temporary, so retry
 * with a short backoff and never treat them as a sign-out.
 */
export async function fetchSocketTicket(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  for (let attempt = 0; ; attempt++) {
    const result = await requestTicket();
    if (result !== "retry" || attempt >= RETRY_DELAYS_MS.length) {
      return result === "retry" ? null : result;
    }
    await wait(RETRY_DELAYS_MS[attempt] ?? 0);
  }
}

async function requestTicket(): Promise<string | null | "retry"> {
  try {
    const res = await fetch("/api/auth/ws-ticket", {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (res.status === 503) return "retry";
    if (!res.ok) return null;
    const json = (await res.json()) as AuthTokenResponse;
    return typeof json.ticket === "string" && json.ticket.length > 0 ? json.ticket : null;
  } catch {
    return "retry";
  }
}
