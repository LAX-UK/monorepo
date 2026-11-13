import {
  type DestinationBinding,
  type Product,
  WRITING_MODES,
  legalEntityFor,
  parseDestinationBinding,
} from "@auction/accounting-domain";
import { ZohoBooksConfigError } from "../config.js";
import type { ZohoOrgConfigs } from "./org-config.js";
import { WRITE_MODE_ENVIRONMENT } from "./write-gate.js";

/**
 * Check the organisations each writing mode is bound to (`BOOKS_ORGANISATIONS`, the one source of
 * those ids) against this process's organisation settings when it starts, and return them as the
 * sender's binding. The settings may hold only some of them (a test deployment configures the test
 * organisations), but an organisation they do hold that is named for a mode must be configured
 * for that product's legal entity and as that mode's environment (`test_org` → `test`, `live` →
 * `live`). So the live organisation, named once under `live`, can never be configured as a test
 * one and receive rehearsal sends, whatever the settings declare. Throws on anything else.
 */
export function parseBooksDestinationBinding(
  organisations: unknown,
  orgs: ZohoOrgConfigs,
): DestinationBinding {
  const parsed = parseDestinationBinding(organisations);
  if (!parsed.ok) throw new ZohoBooksConfigError("destination_binding_invalid");
  const configured = Object.entries(orgs).flatMap(([entity, org]) =>
    org ? [{ entity, org }] : [],
  );
  for (const mode of WRITING_MODES) {
    const bound = Object.entries(parsed.value[mode] ?? {}) as [Product, string][];
    for (const [product, id] of bound) {
      const held = configured.find(({ org }) => org.organizationId === id);
      // Not configured here: that mode cannot reach it in this process, so nothing to check.
      if (!held) continue;
      if (held.entity !== legalEntityFor(product)) {
        throw new ZohoBooksConfigError("destination_binding_wrong_entity");
      }
      if (held.org.environment !== WRITE_MODE_ENVIRONMENT[mode]) {
        throw new ZohoBooksConfigError("destination_binding_wrong_environment");
      }
    }
  }
  return parsed.value;
}
