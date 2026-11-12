import type {
  DocumentKind,
  DocumentLookupPort,
  IssueOutcome,
  Product,
} from "@auction/accounting-domain";
import { toIssueFailure } from "../outcome.js";
import type { ZohoApi } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument } from "./kinds.js";
import type { ZohoOrgConfig } from "./org-config.js";

export interface CreateRequest {
  readonly org: ZohoOrgConfig;
  readonly product: Product;
  readonly kind: DocumentKind;
  readonly reference: string;
  readonly body: unknown;
  readonly query?: Readonly<Record<string, string>>;
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
    private readonly lookup: DocumentLookupPort,
  ) {}

  async create(request: CreateRequest): Promise<IssueOutcome> {
    const { org, kind } = request;
    const spec = KIND_SPECS[kind];
    const reply = await this.api.post(org.organizationId, spec.path, request.body, request.query);
    if (reply.ok) {
      const doc = readProviderDocument(spec, asRecord(reply.value.body)?.[spec.itemKey]);
      return doc
        ? { status: "issued", ...doc }
        : { status: "unknown", detail: "zoho_books_unreadable_document" };
    }
    const { error } = reply;
    const duplicate =
      error.kind === "validation" &&
      error.zohoCode !== undefined &&
      org.duplicateValueZohoCodes.includes(error.zohoCode);
    if (!duplicate) return toIssueFailure(error);
    return this.adopt(request, toIssueFailure(error));
  }

  /** A duplicate refusal means the document exists: take Books' identity for it. */
  private async adopt(
    request: CreateRequest,
    refusal: Extract<IssueOutcome, { status: "rejected" | "unknown" }>,
  ): Promise<IssueOutcome> {
    const found = await this.lookup.findByReference(
      request.product,
      request.kind,
      request.reference,
    );
    switch (found.status) {
      case "found": {
        const { status: _status, ...doc } = found;
        return { status: "issued", ...doc };
      }
      case "not_found":
        return refusal;
      case "ambiguous":
        return { status: "rejected", reason: "zoho_books_duplicate_ambiguous" };
      case "unavailable":
        return { status: "unknown", detail: found.reason };
    }
  }
}
