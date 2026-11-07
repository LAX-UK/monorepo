import type {
  AlertPreferencesRead,
  AlertSourceId,
  AlertSwitchRefusal,
  AlertTopicId,
  TopicState,
} from "../ports/alert-preferences-gateway";

export const ALERTS_FOOTER =
  "Emails about orders, bids, invoices and your account are always sent.";

export type AlertRowVm = {
  topic: AlertTopicId;
  title: string;
  description: string;
  emailOn: boolean;
};

export type AlertSectionVm = {
  id: "bid" | "shop" | "art";
  label: string;
  /** `unavailable`: the product did not answer, so its switches are not shown. */
  state: "ready" | "unavailable";
  unavailableMessage: string;
  rows: AlertRowVm[];
  /** A line under the rows, with an optional link, such as where artists and searches live. */
  note: { text: string; link?: { href: string; label: string }; end?: string } | null;
};

export type AlertsNoticeVm = { title: string; body: string; link: { href: string; label: string } };

export type AlertsPageVm = {
  description: string;
  /** Shown when alerts cannot be switched on yet; every switch is disabled while it is. */
  notice: AlertsNoticeVm | null;
  sections: AlertSectionVm[];
};

type TopicCopy = { title: string; description: string };

/** Each topic's words on this page. One table, so a new topic is one more entry. */
export const ALERT_TOPIC_COPY: Readonly<Record<AlertTopicId, TopicCopy>> = {
  "bid.new_sales": { title: "New sales", description: "When LAX Bid announces a sale" },
  "bid.artists": {
    title: "Artists you follow",
    description: "New lots by artists you follow",
  },
  "bid.searches": {
    title: "Saved searches",
    description: "New lots that match a search you saved",
  },
  "shop.releases": { title: "New editions", description: "When LAX Shop releases an edition" },
  "art.followed_artists": {
    title: "Artists you follow",
    description: "New works by artists you follow on lax.art",
  },
};

type SectionSpec = {
  id: AlertSectionVm["id"];
  label: string;
  source: AlertSourceId;
  topics: readonly AlertTopicId[];
};

/** The products in page order, each with the topics it offers. */
export const ALERT_SECTIONS: readonly SectionSpec[] = [
  {
    id: "bid",
    label: "LAX Bid",
    source: "bid",
    topics: ["bid.new_sales", "bid.artists", "bid.searches"],
  },
  { id: "shop", label: "LAX Shop", source: "shop", topics: ["shop.releases"] },
  { id: "art", label: "lax.art", source: "shop", topics: ["art.followed_artists"] },
];

/** The address with most of the local part hidden, e.g. `r•••@example.com`. */
export function maskAlertEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

export type AlertsPageInput = {
  reads: AlertPreferencesRead;
  email: string | null;
  emailVerified: boolean;
  links: {
    /** Bid's own settings, for app alerts, quiet hours, artists and searches. */
    bidSettings: string | null;
    /** The Shop page that lists editions the person asked to hear about. */
    shopWaiting: string | null;
    /** The hosted page that sends a new verification email. */
    verifyEmail: string;
  };
};

function pluralEditions(count: number): string {
  return `${count} ${count === 1 ? "edition" : "editions"}`;
}

function noteFor(
  spec: SectionSpec,
  read: AlertPreferencesRead[AlertSourceId],
  links: AlertsPageInput["links"],
): AlertSectionVm["note"] {
  if (spec.id === "bid" && links.bidSettings) {
    return {
      text: "App alerts, quiet hours, artists and searches are in",
      link: { href: links.bidSettings, label: "LAX Bid settings" },
      end: ".",
    };
  }
  if (spec.id === "shop" && read.status === "ok" && read.waitingEditions) {
    return {
      text: `You are waiting to hear when ${pluralEditions(read.waitingEditions)} ${
        read.waitingEditions === 1 ? "is" : "are"
      } available again. We email you once for each.`,
      ...(links.shopWaiting ? { link: { href: links.shopWaiting, label: "View" } } : {}),
    };
  }
  return null;
}

function section(spec: SectionSpec, input: AlertsPageInput): AlertSectionVm {
  const read = input.reads[spec.source];
  const base = {
    id: spec.id,
    label: spec.label,
    unavailableMessage: `We couldn't load ${spec.label} alerts. Try again.`,
  };
  if (read.status !== "ok") return { ...base, state: "unavailable", rows: [], note: null };
  const states = new Map<AlertTopicId, TopicState>(read.topics.map((t) => [t.topic, t]));
  return {
    ...base,
    state: "ready",
    // A topic the product did not report is one the person never used: off, so they can start here.
    rows: spec.topics.map((topic) => ({
      topic,
      ...ALERT_TOPIC_COPY[topic],
      emailOn: states.get(topic)?.emailOn ?? false,
    })),
    note: noteFor(spec, read, input.links),
  };
}

export function buildAlertsPage(input: AlertsPageInput): AlertsPageVm {
  const sentTo = input.email ? `, sent to ${maskAlertEmail(input.email)}` : "";
  return {
    description: `Alert emails from each LAX product${sentTo}. At most one email a day from each.`,
    notice: input.emailVerified
      ? null
      : {
          title: "Verify your email",
          body: "Alert emails go only to a verified address. Verify yours to switch alerts on.",
          link: { href: input.links.verifyEmail, label: "Send a new verification email" },
        },
    sections: ALERT_SECTIONS.map((spec) => section(spec, input)),
  };
}

const REFUSAL_MESSAGES: Readonly<Record<AlertSwitchRefusal, string>> = {
  unverified: "Verify your email address to switch alerts on.",
  blocked:
    "Emails to this address were stopped, so alerts can't be switched on here. Contact us to switch them back on.",
  no_account: "We couldn't find your account. Sign in again and try again.",
};

export const ALERT_SWITCH_FAILED_MESSAGE =
  "We couldn't save that just now. Nothing was changed. Please try again in a moment.";

export function alertRefusalMessage(reason: AlertSwitchRefusal): string {
  return REFUSAL_MESSAGES[reason];
}
