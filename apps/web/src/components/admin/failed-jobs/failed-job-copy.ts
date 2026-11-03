/** Said wherever an operator's switch has turned retries and discards off. */
export const ACTIONS_OFF_COPY = {
  title: "Retries and discards are switched off",
  body: "A setting blocks them while an incident is handled. Jobs can still be read. Ask engineering to switch it back on.",
} as const;

const WHAT_TO_DO = "Retry them once the cause is fixed, or discard them with a reason.";

/** The page's one-line purpose, under its title, in the words of what the person can see. */
export const FAILED_JOBS_DESCRIPTION = {
  all: `Background jobs and integration deliveries that ran out of attempts. ${WHAT_TO_DO}`,
  integrations: `Deliveries to Xero and Zoho, and inbound webhooks, that ran out of attempts. ${WHAT_TO_DO}`,
} as const;

/** Wording on the one-job page that depends on where the failure came from. */
export type FailedJobDetailCopy = {
  /** "Task" for a background job, "Event" for a delivery. */
  taskLabel: string;
  originalLabel: string;
  idLabel: string;
  /** The facts section and the rail label that holds it. */
  sectionTitle: string;
  railLabel: string;
  discardedTitle: string;
  retriedNotice: string;
  payloadDescription: string;
  emptyPayload: string;
};

export const FAILED_JOB_DETAIL_COPY: Readonly<
  Record<"background_jobs" | "integrations", FailedJobDetailCopy>
> = {
  background_jobs: {
    taskLabel: "Task",
    originalLabel: "Original job",
    idLabel: "Job ID",
    sectionTitle: "Job",
    railLabel: "Job details",
    discardedTitle: "This job was discarded",
    retriedNotice:
      "It runs again from the start. If it fails again, it comes back to Needs review.",
    payloadDescription: "What the job was asked to do. Personal details are partly hidden.",
    emptyPayload: "The job's data can't be shown here, or it carried none.",
  },
  integrations: {
    taskLabel: "Event",
    originalLabel: "Delivery number",
    idLabel: "Delivery ID",
    sectionTitle: "Delivery",
    railLabel: "Delivery details",
    discardedTitle: "This delivery was discarded",
    retriedNotice: "It was sent again. If it fails again, it comes back to Needs review.",
    payloadDescription:
      "What was being delivered. Personal details are partly hidden, and only fields on the approved list are shown.",
    emptyPayload: "None of this delivery's data is on the approved list, or it carried none.",
  },
};

/** What the delivery's own reference is called: a delivery has a number, a webhook an event key. */
export function integrationReferenceLabel(id: string): string {
  return id.startsWith("webhook:") ? "Event key" : "Delivery number";
}
