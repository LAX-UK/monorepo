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

/**
 * Whether a saved search reaches the person by email: its own switch and the saved-search
 * alerts topic's switch both have to be on. `topicEmailOn` is null when the topic's switch could
 * not be read, and then only the search's own switch can be judged.
 */
export function searchEmailIsOn(notifyEmail: boolean, topicEmailOn: boolean | null): boolean {
  return notifyEmail && topicEmailOn !== false;
}

/** "email on" or "email off"; nothing when where the alert reaches the person is unknown. */
export function searchReachLabel(notifyEmail: boolean, reach: TopicReach | null): string | null {
  if (!reach) return null;
  return searchEmailIsOn(notifyEmail, reach.emailOn) ? "email on" : "email off";
}
