import type { IntegrationKind, IntegrationNameFilter } from "@auction/persistence/interfaces";
import type { FailedJobSource } from "@auction/types";

/** What the screen needs to know about one integration endpoint. */
export type IntegrationEndpoint = {
  /** The access scope its rows fall under. */
  scope: Exclude<FailedJobSource, "background_jobs">;
  /** The name staff know it by. */
  label: string;
  /** What a retry does, in a sentence. */
  retryEffect: string;
  /** A retry may repeat something a person sees. */
  mayRepeat: boolean;
};

const UNKNOWN_DELIVERY: Omit<IntegrationEndpoint, "label"> = {
  scope: "integrations.other",
  retryEffect: "Sends this delivery again from the start. Whoever receives it may see it twice.",
  mayRepeat: true,
};

const UNKNOWN_WEBHOOK: Omit<IntegrationEndpoint, "label"> = {
  scope: "integrations.other",
  retryEffect:
    "Runs the webhook's handler again from the start. It can repeat an email or a ledger entry, so check that a repeat is safe first.",
  mayRepeat: true,
};

/** Deliveries we send out, by consumer. */
export const DELIVERY_ENDPOINTS: Readonly<Record<string, IntegrationEndpoint>> = {
  xero: {
    scope: "integrations.xero",
    label: "Xero",
    retryEffect:
      "Sends this to Xero again with the same reference, so a retry can't create a second invoice or payment.",
    mayRepeat: false,
  },
  zoho: {
    scope: "integrations.zoho",
    label: "Zoho CRM",
    retryEffect: "Updates the same CRM record again. Nothing is created twice.",
    mayRepeat: false,
  },
  zoho_artwork_writeback: {
    scope: "integrations.zoho",
    label: "Zoho artworks (write-back)",
    retryEffect:
      "Reads the Zoho Product again first and sends only what differs, so a retry can't write twice.",
    mayRepeat: false,
  },
  zoho_artwork_listing: {
    scope: "integrations.zoho",
    label: "Zoho artworks (LAX listing)",
    retryEffect:
      "Works out where the artwork is now and sends the listing only if Zoho shows something else, so a retry can't write twice.",
    mayRepeat: false,
  },
};

/** Webhooks we receive, by sender. */
export const WEBHOOK_ENDPOINTS: Readonly<Record<string, IntegrationEndpoint>> = {
  xero: {
    ...UNKNOWN_WEBHOOK,
    scope: "integrations.xero",
    label: "Xero",
  },
  zoho_artwork: {
    ...UNKNOWN_WEBHOOK,
    scope: "integrations.zoho",
    label: "Zoho artworks",
    retryEffect:
      "Reads the Zoho Product again and applies it to the artwork register. Applying the same change twice changes nothing.",
    mayRepeat: false,
  },
  stripe: { ...UNKNOWN_WEBHOOK, label: "Stripe" },
  postmark: { ...UNKNOWN_WEBHOOK, label: "Postmark" },
};

const REGISTRIES: Readonly<Record<IntegrationKind, Readonly<Record<string, IntegrationEndpoint>>>> =
  { delivery: DELIVERY_ENDPOINTS, webhook: WEBHOOK_ENDPOINTS };

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The endpoint for a consumer or sender; one we don't know falls under "other integrations". */
export function integrationEndpoint(kind: IntegrationKind, name: string): IntegrationEndpoint {
  const known = REGISTRIES[kind][name];
  if (known) return known;
  const label = capitalise(name.replace(/[_-]+/g, " "));
  return { ...(kind === "delivery" ? UNKNOWN_DELIVERY : UNKNOWN_WEBHOOK), label };
}

/** The "Job type" filter value for a consumer or sender: `delivery:xero`, `webhook:stripe`. */
export function integrationQueueId(kind: IntegrationKind, name: string): string {
  return `${kind}:${name}`;
}

export function parseIntegrationQueueId(
  queue: string,
): { kind: IntegrationKind; name: string } | null {
  const [kind, ...rest] = queue.split(":");
  const name = rest.join(":");
  return (kind === "delivery" || kind === "webhook") && name ? { kind, name } : null;
}

export function integrationQueueLabel(kind: IntegrationKind, name: string): string {
  const { label } = integrationEndpoint(kind, name);
  return kind === "webhook" ? `${label} webhooks` : label;
}

/** Every endpoint we know of, for filter options that exist before anything has failed. */
export function knownIntegrationQueues(): { kind: IntegrationKind; name: string }[] {
  return (["delivery", "webhook"] as const).flatMap((kind) =>
    Object.keys(REGISTRIES[kind]).map((name) => ({ kind, name })),
  );
}

/**
 * Which names of one kind a person may see, given the scopes they may read. Names the registry
 * doesn't know fall under "other integrations", so they are matched by exclusion. Null means
 * every name; an empty "in" set means none.
 */
export function nameFilterFor(
  kind: IntegrationKind,
  readable: ReadonlySet<FailedJobSource>,
): IntegrationNameFilter | null {
  const entries = Object.entries(REGISTRIES[kind]);
  const allowed = entries.filter(([, endpoint]) => readable.has(endpoint.scope)).map(([n]) => n);
  const blocked = entries.filter(([, endpoint]) => !readable.has(endpoint.scope)).map(([n]) => n);
  if (readable.has("integrations.other")) {
    return blocked.length === 0 ? null : { mode: "not_in", names: blocked };
  }
  return { mode: "in", names: allowed };
}
