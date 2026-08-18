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

export async function fetchSocketTicket(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/ws-ticket", {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AuthTokenResponse;
    return typeof json.ticket === "string" && json.ticket.length > 0 ? json.ticket : null;
  } catch {
    return null;
  }
}
