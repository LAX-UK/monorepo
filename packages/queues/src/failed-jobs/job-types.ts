import {
  EMAIL_QUEUE_NAME,
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  LOT_LIFECYCLE_QUEUE_NAME,
  MARKETING_EVENTS_QUEUE_NAME,
  PAYOUT_SETTLEMENT_QUEUE_NAME,
  PAYOUT_STATEMENTS_QUEUE_NAME,
} from "../queue-names.js";

/** What staff need to know about one kind of job before they retry it. */
export type FailedJobTypeInfo = {
  /** Plain-language job type: "Email", never `email`. */
  label: string;
  /** Where it ran, for the second line of a row. */
  sourceLabel: string;
  /** What a retry does, in a sentence. */
  retryEffect: string;
  /** A retry may repeat something a person sees or something that moves money. */
  mayRepeat: boolean;
  /** When set, a retry from the dashboard is never offered, and this says why. */
  retryBlockedReason?: string;
};

const BACKGROUND_JOB = "Background job";

/**
 * One table for every queue whose exhausted jobs are kept for review. A queue missing here still
 * lists, with a cautious description, so a new queue never hides its failures.
 */
const JOB_TYPES: Readonly<Record<string, FailedJobTypeInfo>> = {
  [EMAIL_QUEUE_NAME]: {
    label: "Email",
    sourceLabel: `${BACKGROUND_JOB} · Email`,
    retryEffect:
      "Sends this email again from the start. If an earlier attempt reached the mail provider, the client could receive it twice.",
    mayRepeat: true,
  },
  [LOT_LIFECYCLE_QUEUE_NAME]: {
    label: "Lot schedule",
    sourceLabel: `${BACKGROUND_JOB} · Lot schedule`,
    retryEffect: "Starts or ends a lot on its schedule.",
    mayRepeat: true,
    retryBlockedReason:
      "Lot start and end jobs aren't retried from here, because a repeat could open or close a lot twice. Hand this to engineering.",
  },
  [MARKETING_EVENTS_QUEUE_NAME]: {
    label: "Ad platform event",
    sourceLabel: `${BACKGROUND_JOB} · Ad platform events`,
    retryEffect: "Sends this event to the ad platform again. Nothing goes to clients.",
    mayRepeat: false,
  },
  [PAYOUT_SETTLEMENT_QUEUE_NAME]: {
    label: "Payout settlement",
    sourceLabel: `${BACKGROUND_JOB} · Payouts`,
    retryEffect: "Starts a payout run again.",
    mayRepeat: true,
    retryBlockedReason:
      "Payout runs aren't retried from here, because a repeat could pay a seller twice. Hand this to engineering.",
  },
  [PAYOUT_STATEMENTS_QUEUE_NAME]: {
    label: "Payout statement",
    sourceLabel: `${BACKGROUND_JOB} · Payouts`,
    retryEffect: "Builds the statement PDF again. Nothing is sent to the seller.",
    mayRepeat: false,
  },
  [LEGAL_ENTITY_ARCHIVE_QUEUE_NAME]: {
    label: "Legal entity archive",
    sourceLabel: `${BACKGROUND_JOB} · Legal entities`,
    retryEffect: "Runs the archive again from the start.",
    mayRepeat: true,
  },
};

function humanise(name: string): string {
  const text = name
    .replace(/[:_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function failedJobTypeInfo(queue: string): FailedJobTypeInfo {
  return (
    JOB_TYPES[queue] ?? {
      label: humanise(queue),
      sourceLabel: BACKGROUND_JOB,
      retryEffect: "Runs the job again from the start.",
      mayRepeat: true,
    }
  );
}

/** The queues that have their own entry, for the queue filter. */
export function knownFailedJobQueues(): { id: string; label: string }[] {
  return Object.entries(JOB_TYPES).map(([id, info]) => ({ id, label: info.label }));
}

/** The job name as a readable phrase ("outbid notice"), or null when it only repeats the queue. */
export function failedJobNameLabel(queue: string, jobName: string | null): string | null {
  if (!jobName) return null;
  const withoutQueue = jobName.startsWith(`${queue}:`) ? jobName.slice(queue.length + 1) : jobName;
  const text = humanise(withoutQueue);
  if (!text || text.toLowerCase() === humanise(queue).toLowerCase()) return null;
  return text;
}
