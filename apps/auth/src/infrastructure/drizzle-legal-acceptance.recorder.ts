import type { LegalAcceptanceRecorder, SignUpLegalAcceptance } from "@auction/auth";
import { type LegalDocumentKind, acceptedLegalDocumentsFor } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { subjectLegalAcceptance } from "@auction/identity-db/schema";

const DOCUMENT_KINDS: readonly LegalDocumentKind[] = ["terms", "privacy"];

/** The rows one sign-up adds: the Terms and the Privacy notice of the company whose documents were shown. */
export function legalAcceptanceRows(acceptance: SignUpLegalAcceptance, acceptedAt: Date) {
  const documents = acceptedLegalDocumentsFor(acceptance.product);
  return DOCUMENT_KINDS.map((kind) => ({
    subjectId: acceptance.subjectId,
    documentKind: kind,
    documentVersion: documents[kind].version,
    documentEffectiveOn: documents[kind].effectiveOn,
    legalEntity: documents.entity,
    product: acceptance.product,
    source: acceptance.source,
    acceptedAt,
  }));
}

/** Adds the record once per document version; a repeated sign-up call changes nothing. */
export class DrizzleLegalAcceptanceRecorder implements LegalAcceptanceRecorder {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordSignUp(acceptance: SignUpLegalAcceptance): Promise<void> {
    await this.db
      .insert(subjectLegalAcceptance)
      .values(legalAcceptanceRows(acceptance, this.now()))
      .onConflictDoNothing();
  }
}
