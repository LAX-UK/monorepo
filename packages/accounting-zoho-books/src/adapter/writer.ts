import type { DocumentKind, IssueOutcome, Product } from "@auction/accounting-domain";
import { toIssueFailure } from "../outcome.js";
import type { ZohoApi } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument } from "./kinds.js";
import type { BooksRecord, ZohoDocumentLookup } from "./lookup.js";
import type { ZohoOrgConfig } from "./org-config.js";

export interface CreateRequest {
  /** The organisation chosen for the document (see `orgFor`); the adopt lookup uses it too. */
  readonly org: ZohoOrgConfig;
  readonly product: Product;
  readonly kind: DocumentKind;
  readonly reference: string;
  /** What the reference field holds, when it is not the reference itself (a vendor contact). */
  readonly storedValue?: string;
  readonly body: unknown;
  readonly query?: Readonly<Record<string, string>>;
  /**
   * Checks the document Books holds is the one we sent, beyond its totals: a rejection reason when
   * it is not. Run on a fresh create and on a document adopted after a duplicate refusal.
   */
  readonly verify?: (item: BooksRecord) => string | null;
}

/**
 * Sends a create and says what became of it. The adapter holds no state: a second create for the
 * same reference is refused by Books (the unique LAX reference field), and that refusal is
 * answered by looking the document up and adopting it, so a duplicate becomes the same document,
 * never a second one. A reply we cannot read is `unknown`, because Books may have made the document.
 */
export class DocumentWriter {
  constructor(
    private readonly api: ZohoApi,
    private readonly lookup: ZohoDocumentLookup,
  ) {}

  async create(request: CreateRequest): Promise<IssueOutcome> {
    const { org, kind } = request;
    const spec = KIND_SPECS[kind];
    const reply = await this.api.post(org.organizationId, spec.path, request.body, request.query);
    if (reply.ok) {
      const item = asRecord(asRecord(reply.value.body)?.[spec.itemKey]);
      const doc = item ? readProviderDocument(spec, item) : null;
      if (!item || !doc) return { status: "unknown", detail: "zoho_books_unreadable_document" };
      const mismatch = request.verify?.(item) ?? null;
      return mismatch ? { status: "rejected", reason: mismatch } : { status: "issued", ...doc };
    }
    const { error } = reply;
    const duplicate =
      error.kind === "validation" &&
      error.zohoCode !== undefined &&
      org.duplicateValueZohoCodes.includes(error.zohoCode);
    if (!duplicate) return toIssueFailure(error);
    return this.adopt(request, toIssueFailure(error));
  }

  /** A duplicate refusal means the document exists: take Books' identity for it, if it is ours. */
  private async adopt(
    request: CreateRequest,
    refusal: Extract<IssueOutcome, { status: "rejected" | "unknown" }>,
  ): Promise<IssueOutcome> {
    const found = await this.lookup.findIn(
      request.org,
      request.product,
      request.kind,
      request.reference,
      request.storedValue,
    );
    switch (found.outcome.status) {
      case "found": {
        const mismatch = found.item ? (request.verify?.(found.item) ?? null) : null;
        if (mismatch) return { status: "rejected", reason: mismatch };
        const { status: _status, ...doc } = found.outcome;
        return { status: "issued", ...doc };
      }
      case "not_found":
        return refusal;
      case "ambiguous":
        return { status: "rejected", reason: "zoho_books_duplicate_ambiguous" };
      case "unavailable":
        return { status: "unknown", detail: found.outcome.reason };
    }
  }
}
