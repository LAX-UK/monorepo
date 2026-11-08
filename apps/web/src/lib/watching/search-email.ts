import { setAlertTopic } from "@/lib/data/http/alerts.client";
import { setSavedSearchEmail } from "@/lib/data/http/saved-searches.client";
import { NOTIFICATION_SETTINGS_HREF } from "@/lib/navigation/settings-links";

/** Whether the person's alerts can be switched on from here, or are held by a choice or a check. */
export type AlertAccess = "ok" | "stopped" | "unverified" | "unreadable";

export type SearchEmailControl =
  /** Off and not changeable here, with why and where to put it right. */
  | { kind: "held"; reason: string; action: { label: string; href: string } }
  | { kind: "switch"; checked: boolean; description?: string };

const HELD: Record<Exclude<AlertAccess, "ok">, { reason: string; label: string }> = {
  stopped: { reason: "You stopped all alerts", label: "Turn alerts back on" },
  unverified: {
    reason: "Verify your email address to get alerts",
    label: "Verify your email",
  },
  unreadable: {
    reason: "We couldn't check your alert settings. Try again.",
    label: "Alert settings",
  },
};

/** Why the switch is off while the saved-search alerts as a whole are off. */
export const TOPIC_OFF_DESCRIPTION =
  "Email is off for saved searches. Turning this on switches it back on.";

/**
 * What a saved search's email control is: held while alerts are stopped or the address is not
 * verified (Settings is where both are put right), otherwise a switch that reads on only while
 * the search's own switch and the saved-search alerts are both on.
 */
export function searchEmailControl(input: {
  access: AlertAccess;
  notifyEmail: boolean;
  /** Whether the saved-search alerts topic's email is on; null when it could not be read. */
  topicEmailOn: boolean | null;
}): SearchEmailControl {
  if (input.access !== "ok") {
    const held = HELD[input.access];
    return {
      kind: "held",
      reason: held.reason,
      action: { label: held.label, href: NOTIFICATION_SETTINGS_HREF },
    };
  }
  const topicOff = input.topicEmailOn === false;
  return {
    kind: "switch",
    checked: input.notifyEmail && !topicOff,
    ...(topicOff ? { description: TOPIC_OFF_DESCRIPTION } : {}),
  };
}

/** Whether turning on one search also switches others on, so the person is asked first. */
export function needsOthersConfirmation(input: {
  topicEmailOn: boolean | null;
  othersOn: number;
}): boolean {
  return input.topicEmailOn === false && input.othersOn > 0;
}

/** "This also turns on email for 2 other saved searches that already had it switched on." */
export function othersConfirmationText(othersOn: number): string {
  const searches = othersOn === 1 ? "1 other saved search" : `${othersOn} other saved searches`;
  return `This also turns on email for ${searches} that already had it switched on.`;
}

/** What to tell the person once email is on, naming any others it brought back with it. */
export function turnedOnMessage(othersBroughtBack: number): string {
  if (othersBroughtBack <= 0) return "Email alerts are on for this search";
  const searches =
    othersBroughtBack === 1 ? "1 other saved search" : `${othersBroughtBack} other saved searches`;
  return `Email alerts are on for this search and ${searches}`;
}

/** What to tell the person when their alert was saved but nothing can be sent yet. */
export function savedWhileHeldMessage(access: Exclude<AlertAccess, "ok">): string {
  if (access === "stopped") return "Alert saved. You stopped all alerts, so nothing will be sent.";
  if (access === "unverified") return "Alert saved. Verify your email address to get alerts.";
  return "Alert saved. We couldn't check your alert settings, so email may not be sent.";
}

export type SearchEmailResult = { ok: true } | { ok: false; error: string };

export type SearchEmailPorts = {
  setSearch: (id: string, on: boolean) => Promise<boolean>;
  /** Makes sure the saved-search alerts topic delivers email. */
  enableTopicEmail: () => Promise<SearchEmailResult>;
};

const httpPorts: SearchEmailPorts = {
  setSearch: setSavedSearchEmail,
  enableTopicEmail: () => setAlertTopic("bid.searches", true, { email: true }),
};

const SAVE_FAILED = "We couldn't save that change. Try again in a moment.";

/**
 * Turns email on or off for one saved search.
 *
 * Nothing is changed unless alerts can be switched on (`access` is "ok"): a stopped client stays
 * stopped. Turning on sets the search's own switch first, which changes nothing the person
 * receives while the topic is off, then switches the topic on; if the topic step fails the
 * search goes back to how it was, and if that fails too the message says exactly what was
 * saved. Turning off leaves the topic alone, since other searches may still use it. With no id
 * (a search saved a moment ago, with email already on) only the topic is switched on.
 */
export async function switchSearchEmail(
  input: {
    id: string | null;
    on: boolean;
    /** The search's own switch before this change, for putting it back. */
    previous: boolean;
    access: AlertAccess;
  },
  ports: SearchEmailPorts = httpPorts,
): Promise<SearchEmailResult> {
  if (input.access !== "ok") return { ok: false, error: HELD[input.access].reason };
  if (!input.on) {
    if (input.id === null) return { ok: true };
    return (await ports.setSearch(input.id, false))
      ? { ok: true }
      : { ok: false, error: SAVE_FAILED };
  }
  if (input.id !== null && !(await ports.setSearch(input.id, true))) {
    return { ok: false, error: SAVE_FAILED };
  }
  const topic = await ports.enableTopicEmail();
  if (topic.ok) return { ok: true };
  if (input.id === null || input.previous) return topic;
  const restored = await ports.setSearch(input.id, input.previous);
  return restored
    ? topic
    : {
        ok: false,
        error: `Email is on for this search, but saved-search alerts are still off. ${topic.error}`,
      };
}
