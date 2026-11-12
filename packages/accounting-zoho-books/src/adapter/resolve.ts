import {
  type DocumentKind,
  type IssueOutcome,
  type Product,
  parseLaxReference,
} from "@auction/accounting-domain";
import type { ZohoDocumentLookup } from "./lookup.js";
import { type ContactType, contactReferenceValue } from "./mappers/contact.js";
import type { ZohoOrgConfig } from "./org-config.js";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";

export type Stop = Extract<IssueOutcome, { status: "rejected" | "unknown" }>;

export type Resolved =
  | { readonly status: "found"; readonly id: string }
  | { readonly status: "stop"; readonly outcome: Stop };

const stop = (outcome: Stop): Resolved => ({ status: "stop", outcome });

/** A document we refer to, in the terms of the document that refers to it. */
export interface Dependency {
  readonly kind: DocumentKind;
  readonly reference: string;
  /** For a contact: whether the document needs a customer or a vendor. */
  readonly contactType?: ContactType;
}

/**
 * Refuse, before any request, a dependency that belongs to another product: its legal entity
 * (and so its organisation) may differ from the document's. Used to check every reference of a
 * document before anything is looked up.
 */
export function sameProduct(product: Product, dependencies: readonly Dependency[]): Stop | null {
  for (const dependency of dependencies) {
    const parsed = parseLaxReference(dependency.reference);
    if (!parsed.ok || parsed.value.kind !== dependency.kind) {
      return { status: "rejected", reason: "zoho_books_bad_reference" };
    }
    if (parsed.value.product !== product) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.entityMismatch };
    }
  }
  return null;
}

/**
 * The Books id of a document we refer to (a contact, an invoice), looked for in the organisation
 * the referring document goes to. A missing dependency is a rejection (the sender orders documents
 * so it should not happen, and a person decides); a contact of the wrong type is a rejection.
 * Anything we cannot tell is `unknown`: nothing was sent, so the life cycle looks again first.
 */
export async function resolveProviderId(
  lookup: ZohoDocumentLookup,
  org: ZohoOrgConfig,
  product: Product,
  dependency: Dependency,
): Promise<Resolved> {
  const { kind, reference, contactType } = dependency;
  const stored =
    kind === "contact" && contactType ? contactReferenceValue(reference, contactType) : reference;
  const found = await lookup.findIn(org, product, kind, reference, stored);
  switch (found.outcome.status) {
    case "found":
      if (contactType && found.item?.contact_type !== contactType) {
        return stop({
          status: "rejected",
          reason:
            contactType === "vendor"
              ? ZOHO_BOOKS_REJECTIONS.contactNotVendor
              : ZOHO_BOOKS_REJECTIONS.contactNotCustomer,
        });
      }
      return { status: "found", id: found.outcome.providerId };
    case "not_found":
      return stop({ status: "rejected", reason: `zoho_books_${kind}_missing` });
    case "ambiguous":
      return stop({ status: "rejected", reason: `zoho_books_${kind}_ambiguous` });
    case "unavailable":
      return stop({ status: "unknown", detail: found.outcome.reason });
  }
}
