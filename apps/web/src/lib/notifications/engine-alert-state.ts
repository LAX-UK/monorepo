import type { AccountAlerts } from "@/lib/data/http/alerts.server";
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
 * Whether the saved-search alerts topic delivers email: false once the client stopped alerts or
 * has no verified address (nothing is sent either way), null only when the read failed or the
 * topic has no row yet.
 */
export function searchTopicEmailOn(
  mine: AccountAlerts | null,
  emailVerified: boolean | undefined,
): boolean | null {
  if (!mine) return null;
  if (emailVerified === false || mine.state === "stopped") return false;
  return engineAlertStateOf(mine)?.email["bid.searches"] ?? null;
}
