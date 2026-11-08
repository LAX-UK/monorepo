import type { AccountAlerts } from "@/lib/data/http/alerts.server";
import type { AlertAccess } from "@/lib/watching/search-email";
import type { EngineAlertState } from "./alert-matrix";

/** The engine's rows as the matrix reads them; a stopped or unknown client has no subscription. */
export function engineAlertStateOf(mine: AccountAlerts | null): EngineAlertState | null {
  if (!mine) return null;
  const active = mine.state === "confirmed";
  return {
    subscribed: Object.fromEntries(mine.topics.map((t) => [t.topic, active])),
    email: Object.fromEntries(mine.topics.map((t) => [t.topic, active && t.emailOn])),
  };
}

/**
 * Whether alerts can be switched on for this client: held once they stopped all alerts, or while
 * their address is not verified (nothing is sent either way). Unknown reads count as "ok", since
 * the API refuses a switch it can't honour.
 */
export function alertAccessOf(
  mine: AccountAlerts | null,
  emailVerified: boolean | undefined,
): AlertAccess {
  if (emailVerified === false) return "unverified";
  if (mine?.state === "stopped") return "stopped";
  return "ok";
}

/**
 * Whether the saved-search alerts topic delivers email: false when alerts are held (see
 * `alertAccessOf`), null only when the read failed or the topic has no row yet.
 */
export function searchTopicEmailOn(
  mine: AccountAlerts | null,
  emailVerified: boolean | undefined,
): boolean | null {
  if (!mine) return null;
  if (alertAccessOf(mine, emailVerified) !== "ok") return false;
  return engineAlertStateOf(mine)?.email["bid.searches"] ?? null;
}
