import type {
  DocumentKind,
  DocumentLookupPort,
  IssueOutcome,
  Product,
} from "@auction/accounting-domain";

export type Resolved =
  | { readonly status: "found"; readonly id: string }
  | {
      readonly status: "stop";
      readonly outcome: Extract<IssueOutcome, { status: "rejected" | "unknown" }>;
    };

/**
 * The Books id of a document we refer to (a contact, an invoice). A missing dependency is a
 * rejection (the sender orders documents so it should not happen, and a person decides). Anything
 * we cannot tell is `unknown`: nothing was sent, so the life cycle looks again before it retries.
 */
export async function resolveProviderId(
  lookup: DocumentLookupPort,
  product: Product,
  kind: DocumentKind,
  reference: string,
): Promise<Resolved> {
  const found = await lookup.findByReference(product, kind, reference);
  switch (found.status) {
    case "found":
      return { status: "found", id: found.providerId };
    case "not_found":
      return {
        status: "stop",
        outcome: { status: "rejected", reason: `zoho_books_${kind}_missing` },
      };
    case "ambiguous":
      return {
        status: "stop",
        outcome: { status: "rejected", reason: `zoho_books_${kind}_ambiguous` },
      };
    case "unavailable":
      return { status: "stop", outcome: { status: "unknown", detail: found.reason } };
  }
}
