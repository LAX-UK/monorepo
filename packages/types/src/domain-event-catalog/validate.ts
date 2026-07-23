import type { z } from "zod";
import { DOMAIN_EVENT_REGISTRY } from "./registry.js";

export type ParseDomainEventPayloadResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; issues?: z.ZodIssue[] };

/**
 * Validates a stored domain event payload against the frozen catalog for the given type/version.
 * Returns a safe, stringly error (no thrown exceptions).
 */
export function parseDomainEventPayload(
  eventType: string,
  schemaVersion: number,
  payload: unknown,
): ParseDomainEventPayloadResult {
  const definition = DOMAIN_EVENT_REGISTRY[eventType as keyof typeof DOMAIN_EVENT_REGISTRY];
  if (!definition) {
    return { ok: false, error: `Unknown domain event type: ${eventType}` };
  }

  const schema = definition.payloadSchemas[schemaVersion];
  if (!schema) {
    return {
      ok: false,
      error: `Unsupported schema version ${schemaVersion} for ${eventType}`,
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.message,
      issues: parsed.error.issues,
    };
  }

  return { ok: true, data: parsed.data };
}
