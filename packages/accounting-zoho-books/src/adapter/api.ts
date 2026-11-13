import { type LegalEntity, type Product, legalEntityFor } from "@auction/accounting-domain";
import type { ZohoBooksClient } from "../client.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";

/** The only part of the HTTP client the adapter uses: three calls, so a test can stand in for it. */
export type ZohoApi = Pick<ZohoBooksClient, "get" | "post" | "put">;

export type OrgChoice =
  | { readonly ok: true; readonly org: ZohoOrgConfig; readonly entity: LegalEntity }
  | { readonly ok: false; readonly reason: string };

/**
 * The one place a Books organisation is chosen for a document. The legal entity is derived from
 * the product, and a document whose own `entity` says otherwise is refused: the domain builders
 * keep the two in step, but the ports accept any object of the type, so the adapter checks rather
 * than trusts. Every lookup, dependency and write for the document then uses the organisation
 * returned here, never one picked again from another field.
 */
export function orgFor(
  orgs: ZohoOrgConfigs,
  doc: { readonly product: Product; readonly entity?: LegalEntity },
): OrgChoice {
  const entity = legalEntityFor(doc.product);
  if (doc.entity !== undefined && doc.entity !== entity) {
    return { ok: false, reason: ZOHO_BOOKS_REJECTIONS.entityMismatch };
  }
  const org = orgs[entity];
  return org
    ? { ok: true, org, entity }
    : { ok: false, reason: ZOHO_BOOKS_REJECTIONS.organisationNotConfigured };
}
