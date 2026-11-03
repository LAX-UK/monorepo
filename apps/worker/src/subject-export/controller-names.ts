import { LEGAL_ENTITIES } from "@auction/branding";
import {
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportProduct,
} from "@auction/identity-contracts";

/**
 * The registered company names that answer for a product's data, joined for a sentence. The
 * names come from the shared legal-entity registry, so a change there reaches every file in the ZIP.
 */
export function controllerNamesFor(product: SubjectExportProduct): string {
  const names = SUBJECT_EXPORT_PRODUCT_INFO[product].controllers.map(
    (id) => LEGAL_ENTITIES[id].name,
  );
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
