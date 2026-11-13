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
 * Read the organisation each writing mode may send each product's documents to, and check it
 * against the organisation settings when the process starts. Every bound id must be the
 * organisation configured for the product's legal entity, and of that mode's environment
 * (`test_org` → a `test` organisation, `live` → a `live` one), so the live organisation can never
 * be bound as a rehearsal target. Throws on anything else.
 */
export function parseBooksDestinationBinding(
  input: unknown,
  orgs: ZohoOrgConfigs,
): DestinationBinding {
  const parsed = parseDestinationBinding(input);
  if (!parsed.ok) throw new ZohoBooksConfigError("destination_binding_invalid");
  for (const mode of WRITING_MODES) {
    const bound = Object.entries(parsed.value[mode] ?? {}) as [Product, string][];
    for (const [product, id] of bound) {
      const org = orgs[legalEntityFor(product)];
      if (!org || org.organizationId !== id) {
        throw new ZohoBooksConfigError("destination_binding_unknown_org");
      }
      if (org.environment !== WRITE_MODE_ENVIRONMENT[mode]) {
        throw new ZohoBooksConfigError("destination_binding_wrong_environment");
      }
    }
  }
  return parsed.value;
}
