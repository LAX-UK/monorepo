import { apiBaseUrl } from "@/lib/auth/api-base";
import type {
  ConfirmResult,
  StopChoice,
  StopResult,
} from "@auction/marketing-ui/alerts/alert-link-page";

const url = (path: string) => `${apiBaseUrl()}/alerts${path}`;

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Presses the confirm button's request. Opening the page never calls this. */
export async function confirmAlertLink(token: string): Promise<ConfirmResult> {
  const res = await post("/confirm", { token });
  if (!res?.ok) return res?.status === 400 ? "invalid" : "failed";
  const body = (await res.json().catch(() => null)) as { outcome?: string } | null;
  const outcome = body?.outcome;
  return outcome === "confirmed" ||
    outcome === "already_confirmed" ||
    outcome === "expired" ||
    outcome === "invalid"
    ? outcome
    : "failed";
}

/** Stops every topic, or only the one the person came from. */
export async function stopAlertLink(token: string, choice: StopChoice): Promise<StopResult> {
  const res = await post("/stop", {
    token,
    scope: choice.scope,
    ...(choice.scope === "topic" ? { topic: choice.topic } : {}),
    via: "page",
  });
  if (!res) return "failed";
  if (res.status === 400) return "invalid";
  if (!res.ok) return "failed";
  const body = (await res.json().catch(() => null)) as { outcome?: string } | null;
  return body?.outcome === "already_stopped" ? "already_stopped" : "stopped";
}

export type AlertSwitchResult = { ok: true } | { ok: false; error: string };

/** A signed-in client's own switch for one topic's email. */
export async function setAlertTopic(
  topic: string,
  on: boolean,
  options: { email?: boolean; restart?: boolean } = {},
): Promise<AlertSwitchResult> {
  try {
    const res = await fetch(url(`/me/topics/${encodeURIComponent(topic)}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        on,
        ...(options.email === undefined ? {} : { email: options.email }),
        ...(options.restart ? { restart: true } : {}),
      }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error ?? "We couldn't save that. Try again in a moment." };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}

/** The signed-in client's own switches, from the browser; null if unreadable. */
export async function loadAccountAlerts(): Promise<{
  state: "none" | "pending" | "confirmed" | "stopped";
  topics: { topic: string; emailOn: boolean }[];
} | null> {
  try {
    const res = await fetch(url("/me"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        state: "none" | "pending" | "confirmed" | "stopped";
        topics: { topic: string; emailOn: boolean }[];
      };
    };
    return body.data ?? null;
  } catch {
    return null;
  }
}
