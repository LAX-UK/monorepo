import type { FailedJobBatchResult } from "@auction/types";

/** What the API says when it refuses one job, in words a person can act on. */
const REFUSAL_COPY: Readonly<Record<string, string>> = {
  job_not_found: "This job no longer exists.",
  not_permitted: "Your role can look at this but not change it.",
  actions_disabled:
    "Retries and discards are switched off while an incident is handled. Ask engineering to switch them back on.",
  retry_not_allowed: "This kind of job can't be retried from here.",
  already_retried: "This job has already been retried.",
  job_discarded: "This job was discarded. Restore it first.",
  repeat_not_confirmed: "Tick the box to confirm a repeat is safe.",
  not_discarded: "This job isn't discarded.",
  rate_limit_exceeded: "Too many retries in a minute. Wait a moment, then try again.",
  payload_not_available: "The job's data was not kept, so it can't be run again.",
  retry_failed: "The job could not be queued again. Try again in a moment.",
};

export function failedJobRefusal(code: string): string {
  return REFUSAL_COPY[code] ?? "This job could not be changed. Try again in a moment.";
}

export type FailedJobOutcome = {
  succeeded: number;
  failures: { id: string; message: string }[];
};

/** Counts what worked and keeps the refusals, worded for the dialog. */
export function summariseBatch(result: FailedJobBatchResult): FailedJobOutcome {
  const failures: FailedJobOutcome["failures"] = [];
  let succeeded = 0;
  for (const outcome of result.results) {
    if (outcome.ok) succeeded += 1;
    else failures.push({ id: outcome.id, message: failedJobRefusal(outcome.error) });
  }
  return { succeeded, failures };
}

type Noun = { one: string; other: string };
const JOBS: Noun = { one: "job", other: "jobs" };

/** The noun for a set of ids, read from their prefixes: integrations are deliveries. */
export function nounForIds(ids: readonly string[]): Noun {
  const deliveries =
    ids.length > 0 && ids.every((id) => id.startsWith("delivery:") || id.startsWith("webhook:"));
  return deliveries ? { one: "delivery", other: "deliveries" } : JOBS;
}

/** "3 jobs", "1 job"; "3 deliveries" when that is what is being listed. */
export function jobCount(count: number, noun: Noun = JOBS): string {
  return `${count} ${count === 1 ? noun.one : noun.other}`;
}

/** The toast after a decision: "Retried 3 jobs" or "Retried 2 of 3 jobs". */
export function outcomeToast(verb: string, outcome: FailedJobOutcome, noun: Noun = JOBS): string {
  const total = outcome.succeeded + outcome.failures.length;
  return outcome.failures.length === 0
    ? `${verb} ${jobCount(outcome.succeeded, noun)}`
    : `${verb} ${outcome.succeeded} of ${jobCount(total, noun)}`;
}
