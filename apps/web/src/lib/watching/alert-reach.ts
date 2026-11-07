import type { EngineAlertState } from "@/lib/notifications/alert-matrix";

/** Where one alert reaches the person: by email (and so in the app) or nowhere. */
export type TopicReach = { emailOn: boolean; appOn: boolean };

/** Reach for the two alerts Watching edits; null when the engine's switches could not be read. */
export type WatchingAlertReach = { artists: TopicReach; searches: TopicReach } | null;

type AppSwitches = { artistAlertsInApp: boolean; searchAlertsInApp: boolean };

/**
 * What the person's switches mean for artist and search alerts. Matches are only recorded while
 * the topic's email is on, so an app notice follows the email switch and its own app switch.
 */
export function watchingAlertReach(
  engine: EngineAlertState | null,
  app: AppSwitches | null,
): WatchingAlertReach {
  if (!engine || !app) return null;
  const topic = (name: string, appSwitch: boolean): TopicReach => {
    const emailOn = engine.email[name] === true;
    return { emailOn, appOn: emailOn && appSwitch };
  };
  return {
    artists: topic("bid.artists", app.artistAlertsInApp),
    searches: topic("bid.searches", app.searchAlertsInApp),
  };
}

/** "email and app", "email only" or "email off". */
export function reachLabel(reach: TopicReach): string {
  if (!reach.emailOn) return "email off";
  return reach.appOn ? "email and app" : "email only";
}

/** A saved search's own email switch and the topic's switch both have to be on. */
export function searchReachLabel(notifyEmail: boolean, reach: TopicReach | null): string {
  const on = notifyEmail && (reach ? reach.emailOn : true);
  return on ? "email on" : "email off";
}
