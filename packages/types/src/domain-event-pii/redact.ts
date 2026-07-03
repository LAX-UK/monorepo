/** domain event payload minimisation for logs and exports.
 * Default-deny for string leaves; recursive walk with per-event allowlists.
 */

import { isSafeLeaf } from "./allowlists.js";

export type RedactDomainEventPayloadOptions = {
  /** When true (e.g. caller holds `audit.read_pii`), payload is returned unchanged. */
  includePii?: boolean;
};

function redactLeaf(
  eventType: string,
  path: string,
  segment: string,
  value: string,
  opts: RedactDomainEventPayloadOptions,
): string {
  if (opts.includePii) return value;
  if (isSafeLeaf(eventType, path, segment)) return value;
  return "[REDACTED]";
}

function walk(
  eventType: string,
  value: unknown,
  path: string,
  opts: RedactDomainEventPayloadOptions,
): unknown {
  if (opts.includePii) return value;
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const segment = path.includes(".") ? (path.split(".").pop() ?? path) : path;
    return redactLeaf(eventType, path, segment, value, opts);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) =>
      walk(eventType, item, path === "" ? `${i}` : `${path}.${i}`, opts),
    );
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path === "" ? k : `${path}.${k}`;
      out[k] = walk(eventType, v, nextPath, opts);
    }
    return out;
  }
  return value;
}

/** Minimises PII in a stored domain event payload for exports and worker logs.
 * @param eventType `domain_events.event_type`
 * @param payload JSON payload object
 */
export function redactDomainEventPayload(
  eventType: string,
  payload: unknown,
  opts: RedactDomainEventPayloadOptions = {},
): unknown {
  if (opts.includePii) return payload;
  return walk(eventType, payload, "", opts);
}
