import {
  type DocumentKind,
  type DocumentLookupPort,
  type LookupOutcome,
  type Product,
  legalEntityFor,
  parseLaxReference,
} from "@auction/accounting-domain";
import { toLookupFailure } from "../outcome.js";
import type { ZohoApi } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument, storedReference } from "./kinds.js";
import type { ZohoOrgConfigs } from "./org-config.js";

/**
 * Finds a document in the right organisation by its LAX reference custom field. A hit is only
 * believed when the document read back carries that exact reference, so a filter Books ignored can
 * never make us adopt someone else's document. Absence is only ever "the search found nothing";
 * anything unclear is `unavailable`, which the life cycle never turns into a resend.
 */
export class ZohoDocumentLookup implements DocumentLookupPort {
  constructor(
    private readonly api: ZohoApi,
    private readonly orgs: ZohoOrgConfigs,
  ) {}

  async findByReference(
    product: Product,
    kind: DocumentKind,
    reference: string,
  ): Promise<LookupOutcome> {
    const org = this.orgs[legalEntityFor(product)];
    if (!org) return { status: "unavailable", reason: "zoho_books_organisation_not_configured" };
    const parsed = parseLaxReference(reference);
    if (!parsed.ok || parsed.value.product !== product || parsed.value.kind !== kind) {
      return { status: "unavailable", reason: "zoho_books_bad_reference" };
    }
    const spec = KIND_SPECS[kind];
    const { apiName } = org.laxReferenceField;

    // Two rows are enough to tell one from many.
    const list = await this.api.get(org.organizationId, spec.path, {
      [apiName]: reference,
      per_page: 2,
    });
    if (!list.ok) return toLookupFailure(list.error);
    const rows = asRecord(list.value.body)?.[spec.listKey];
    if (!Array.isArray(rows))
      return { status: "unavailable", reason: "zoho_books_unreadable_list" };
    if (rows.length === 0) return { status: "not_found" };
    if (rows.length > 1) return { status: "ambiguous", count: rows.length };

    const id = asRecord(rows[0])?.[spec.idField];
    if (typeof id !== "string" || !/^[0-9]{1,32}$/.test(id)) {
      return { status: "unavailable", reason: "zoho_books_unreadable_list" };
    }
    const detail = await this.api.get(org.organizationId, `${spec.path}/${id}`);
    if (!detail.ok) return toLookupFailure(detail.error);
    const item = asRecord(asRecord(detail.value.body)?.[spec.itemKey]);
    if (!item || storedReference(item, apiName) !== reference) {
      return { status: "unavailable", reason: "zoho_books_reference_not_confirmed" };
    }
    const doc = readProviderDocument(spec, item);
    if (!doc) return { status: "unavailable", reason: "zoho_books_unreadable_document" };
    return { status: "found", ...doc };
  }
}
