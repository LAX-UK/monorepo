import { parseAccountEmailAlerts } from "@auction/shop-contracts";
import {
  ALERT_TOPIC_IDS,
  type AlertPreferencesGateway,
  type AlertPreferencesRead,
  type AlertSourceId,
  type AlertSourceRead,
  type AlertSwitchRefusal,
  type AlertSwitchResult,
  type AlertTopicId,
  type TopicState,
} from "../ports/alert-preferences-gateway";
import type {
  AccountProductScope,
  ResourceTokenProvider,
  SessionHandle,
} from "../ports/portfolio-gateway";
import { withDeadline } from "./with-deadline";

export const ALERTS_READ_TIMEOUT_MS = 4_000;
export const ALERTS_WRITE_TIMEOUT_MS = 8_000;

type SourceRoutes = {
  resource: "lax-bid-api" | "lax-shop-api";
  read: string;
  topic: (topic: AlertTopicId) => string;
  parse: (body: unknown) => AlertSourceRead | null;
};

const REFUSALS: readonly AlertSwitchRefusal[] = ["unverified", "blocked", "no_account"];

const isTopicId = (value: unknown): value is AlertTopicId =>
  typeof value === "string" && (ALERT_TOPIC_IDS as readonly string[]).includes(value);

/** Bid answers `{ data: { state, topics: [{ topic, emailOn }] } }`; an address only counts once confirmed. */
function parseBid(body: unknown): AlertSourceRead | null {
  const data = (body as { data?: { state?: unknown; topics?: unknown } } | null)?.data;
  if (!data || !Array.isArray(data.topics)) return null;
  const confirmed = data.state === "confirmed";
  const topics: TopicState[] = [];
  for (const entry of data.topics as Array<{ topic?: unknown; emailOn?: unknown }>) {
    if (isTopicId(entry.topic) && entry.topic.startsWith("bid.")) {
      topics.push({ topic: entry.topic, emailOn: confirmed && entry.emailOn === true });
    }
  }
  return { status: "ok", topics };
}

function parseShop(body: unknown): AlertSourceRead | null {
  try {
    const view = parseAccountEmailAlerts(body);
    return {
      status: "ok",
      topics: view.topics.map(({ topic, emailOn }) => ({ topic, emailOn })),
      waitingEditions: view.waitingEditions,
    };
  } catch {
    return null;
  }
}

/**
 * Calls each product's alert routes as the signed-in person, with a token that carries only the
 * alert scopes and is issued for that product alone. Every failure (no URL configured, token
 * refused, timeout, error status, body off-contract) becomes `unavailable` for that product;
 * nothing is logged beyond the product and a reason, and never a token or a body.
 */
export function createProductAlertPreferencesGateway(deps: {
  apiUrls: Partial<Record<AlertSourceId, string>>;
  tokens: ResourceTokenProvider;
  fetchImpl?: typeof fetch;
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
}): AlertPreferencesGateway {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const readTimeoutMs = deps.readTimeoutMs ?? ALERTS_READ_TIMEOUT_MS;
  const writeTimeoutMs = deps.writeTimeoutMs ?? ALERTS_WRITE_TIMEOUT_MS;

  const routes: Record<AlertSourceId, SourceRoutes> = {
    bid: {
      resource: "lax-bid-api",
      read: "/alerts/me",
      topic: (topic) => `/alerts/me/topics/${encodeURIComponent(topic)}`,
      parse: parseBid,
    },
    shop: {
      resource: "lax-shop-api",
      read: "/v1/me/email-alerts",
      topic: (topic) => `/v1/me/email-alerts/topics/${encodeURIComponent(topic)}`,
      parse: parseShop,
    },
  };

  const sourceOf = (topic: AlertTopicId): AlertSourceId =>
    topic.startsWith("bid.") ? "bid" : "shop";

  async function call(
    source: AlertSourceId,
    handle: SessionHandle,
    scope: AccountProductScope,
    path: string,
    init: { method: "GET" | "PUT"; body?: unknown },
    signal: AbortSignal,
  ): Promise<Response> {
    const token = await deps.tokens.tokenFor(handle, routes[source].resource, scope);
    return fetchImpl(`${deps.apiUrls[source]}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
      signal,
    });
  }

  async function readOne(source: AlertSourceId, handle: SessionHandle): Promise<AlertSourceRead> {
    if (!deps.apiUrls[source]) {
      console.warn("account_alerts_source_unconfigured", { source });
      return { status: "unavailable" };
    }
    try {
      return await withDeadline(readTimeoutMs, async (signal) => {
        const response = await call(
          source,
          handle,
          "lax.alerts.read",
          routes[source].read,
          { method: "GET" },
          signal,
        );
        if (!response.ok) {
          console.warn("account_alerts_read_failed", { source, status: response.status });
          return { status: "unavailable" } as const;
        }
        return routes[source].parse(await response.json()) ?? ({ status: "unavailable" } as const);
      });
    } catch (error) {
      console.warn("account_alerts_read_failed", {
        source,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  return {
    async read(handle): Promise<AlertPreferencesRead> {
      const [bid, shop] = await Promise.all([readOne("bid", handle), readOne("shop", handle)]);
      return { bid, shop };
    },

    async setTopic(handle, change): Promise<AlertSwitchResult> {
      const source = sourceOf(change.topic);
      if (!deps.apiUrls[source]) return { status: "unavailable" };
      try {
        return await withDeadline(writeTimeoutMs, async (signal) => {
          const response = await call(
            source,
            handle,
            "lax.alerts.write",
            routes[source].topic(change.topic),
            { method: "PUT", body: { on: change.on } },
            signal,
          );
          if (response.ok) return { status: "ok" } as const;
          if (response.status === 401) return { status: "signed_out" } as const;
          if (response.status === 409) {
            const body = (await response.json().catch(() => null)) as { reason?: unknown } | null;
            const reason = REFUSALS.find((candidate) => candidate === body?.reason);
            if (reason) return { status: "refused", reason } as const;
          }
          console.warn("account_alerts_write_failed", { source, status: response.status });
          return { status: "unavailable" } as const;
        });
      } catch (error) {
        console.warn("account_alerts_write_failed", {
          source,
          reason: error instanceof Error ? error.name : "unknown",
        });
        return { status: "unavailable" };
      }
    },
  };
}
