import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";
import { currentVisitorIpHeaders } from "@/lib/http/visitor-ip.server";

/** Where LAX Bid's alerts API lives. */
const base = () => `${getServerApiBase()}/alerts`;

export type ConfirmLinkPreview =
  | { state: "ready" | "already_confirmed"; maskedEmail: string }
  | { state: "expired" | "invalid" };

export type StopLinkPreview =
  | {
      state: "ready";
      maskedEmail: string;
      topics: string[];
      fromTopic: string | null;
    }
  | { state: "already_stopped"; maskedEmail: string }
  | { state: "invalid" };

/** A signed-in client's own alert switches. */
export type AccountAlerts = {
  state: "none" | "pending" | "confirmed" | "stopped";
  linked: boolean;
  topics: { topic: string; emailOn: boolean }[];
};

/**
 * The visitor's address, passed on so the API limits sign-ups per visitor and not per web server
 * (every visitor reaches the API from the same place).
 */
function clientIpHeaders(): Promise<Record<string, string>> {
  return currentVisitorIpHeaders();
}

export async function forwardAlertSignup(input: {
  email: string;
  source: string;
}): Promise<Response> {
  return fetch(`${base()}/subscribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: await deriveSsrOrigin(),
      ...(await clientIpHeaders()),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** What a link would do, read without changing anything. Null when the check could not be made. */
export async function readAlertLink(
  kind: "confirm",
  token: string,
): Promise<ConfirmLinkPreview | null>;
export async function readAlertLink(kind: "stop", token: string): Promise<StopLinkPreview | null>;
export async function readAlertLink(
  kind: "confirm" | "stop",
  token: string,
): Promise<ConfirmLinkPreview | StopLinkPreview | null> {
  try {
    const res = await fetch(`${base()}/link-preview?kind=${kind}&t=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (res.status === 400) return { state: "invalid" };
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: ConfirmLinkPreview | StopLinkPreview };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** A mail app's one-click unsubscribe, passed on to the API. True when every topic is stopped. */
export async function stopAlertsOneClick(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/stop`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: await deriveSsrOrigin() },
      body: JSON.stringify({ token, scope: "all", via: "one_click" }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The signed-in client's own switches; null if unreadable. */
export async function getServerAccountAlerts(): Promise<AccountAlerts | null> {
  try {
    const res = await authedServerFetch("/alerts/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: AccountAlerts };
    return body.data ?? null;
  } catch {
    return null;
  }
}
