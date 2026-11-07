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
