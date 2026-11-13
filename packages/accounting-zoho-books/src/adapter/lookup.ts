import {
  type DocumentKind,
  type LookupOutcome,
  type Product,
  parseLaxReference,
} from "@auction/accounting-domain";
import { toLookupFailure } from "../outcome.js";
import { type ZohoApi, orgFor } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument, storedReference } from "./kinds.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";

export type BooksRecord = Readonly<Record<string, unknown>>;

/** What a search by reference can say: it finds by identity, so never `differs` on its own. */
export type IdentityOutcome = Exclude<LookupOutcome, { readonly status: "differs" }>;

/** A lookup's outcome, and the document Books returned when it found one (for further checks). */
export interface OrgLookup {
  readonly outcome: IdentityOutcome;
  readonly item: BooksRecord | null;
}

const miss = (outcome: IdentityOutcome): OrgLookup => ({ outcome, item: null });

/**
 * Finds a document in the right organisation by its LAX reference custom field. A hit is only
 * believed when the document read back carries that exact reference, so a filter Books ignored can
 * never make us adopt someone else's document. Absence is only ever "the search found nothing";
 * anything unclear is `unavailable`, which the life cycle never turns into a resend. It finds by
 * identity only; the life cycle's lookup (`ZohoReadBackLookup`) also checks what it finds.
 */
export class ZohoDocumentLookup {
  constructor(
    private readonly api: ZohoApi,
    private readonly orgs: ZohoOrgConfigs,
  ) {}

  async findByReference(
    product: Product,
    kind: DocumentKind,
    reference: string,
  ): Promise<IdentityOutcome> {
    const choice = orgFor(this.orgs, { product });
    if (!choice.ok) return { status: "unavailable", reason: choice.reason };
    return (await this.findIn(choice.org, product, kind, reference)).outcome;
  }

  /**
   * Search one organisation, already chosen for the document being written (see `orgFor`), so a
   * dependency is always looked for in the same organisation the document goes to. `storedValue`
   * is what the reference field holds when it is not the reference itself (a vendor contact).
   */
  async findIn(
    org: ZohoOrgConfig,
    product: Product,
    kind: DocumentKind,
    reference: string,
    storedValue: string = reference,
  ): Promise<OrgLookup> {
    const parsed = parseLaxReference(reference);
    if (!parsed.ok || parsed.value.product !== product || parsed.value.kind !== kind) {
      return miss({ status: "unavailable", reason: "zoho_books_bad_reference" });
    }
    const spec = KIND_SPECS[kind];
    const { apiName } = org.laxReferenceField;

    // Two rows are enough to tell one from many.
    const list = await this.api.get(org.organizationId, spec.path, {
      [apiName]: storedValue,
      per_page: 2,
    });
    if (!list.ok) return miss(toLookupFailure(list.error));
    const rows = asRecord(list.value.body)?.[spec.listKey];
    if (!Array.isArray(rows)) {
      return miss({ status: "unavailable", reason: "zoho_books_unreadable_list" });
    }
    if (rows.length === 0) return miss({ status: "not_found" });
    if (rows.length > 1) return miss({ status: "ambiguous", count: rows.length });

    const id = asRecord(rows[0])?.[spec.idField];
    if (typeof id !== "string" || !/^[0-9]{1,32}$/.test(id)) {
      return miss({ status: "unavailable", reason: "zoho_books_unreadable_list" });
    }
    const detail = await this.api.get(org.organizationId, `${spec.path}/${id}`);
    if (!detail.ok) return miss(toLookupFailure(detail.error));
    const item = asRecord(asRecord(detail.value.body)?.[spec.itemKey]);
    if (!item || storedReference(item, apiName) !== storedValue) {
      return miss({ status: "unavailable", reason: "zoho_books_reference_not_confirmed" });
    }
    const doc = readProviderDocument(spec, item);
    if (!doc) return miss({ status: "unavailable", reason: "zoho_books_unreadable_document" });
    return { outcome: { status: "found", ...doc }, item };
  }
}
