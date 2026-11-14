/**
 * Every reason the adapter itself refuses a document, as a fixed code a caller can branch on. A
 * refusal here means nothing was posted for the document. A read-back mismatch (a payment or contact
 * Books holds under our reference that is not what we sent) comes back as `differs` with Books'
 * identity, never as a refusal: it is held for staff, never retried and never adjusted.
 */
export const ZOHO_BOOKS_REJECTIONS = {
  /** No Books organisation is configured for the document's legal entity (Bid, until it exists). */
  organisationNotConfigured: "zoho_books_organisation_not_configured",
  /** The document's entity, its product, or a document it refers to disagree on the organisation. */
  entityMismatch: "zoho_books_entity_mismatch",
  /** The adapter is in dry-run (the default) or the organisation is not on the write allow-list. */
  writesDisabled: "zoho_books_writes_disabled",
  /** A line carries VAT, or claims standard rate, for an organisation that is not VAT registered. */
  vatOnUnregisteredEntity: "zoho_books_mapping_vat_on_unregistered_entity",
  /** A line carries VAT but the organisation has no tax id for its treatment. */
  noTaxId: "zoho_books_mapping_no_tax_id",
  /** Books would work out a different VAT for a line than the VAT LAX stated. */
  vatDiffersFromBooks: "zoho_books_mapping_vat_differs_from_books",
  /** A line's amount basis disagrees with the document (or a bill line is tax inclusive). */
  mixedBasis: "zoho_books_mapping_mixed_basis",
  /** A payment allocation names an invoice whose Books id was not resolved. */
  unresolvedInvoice: "zoho_books_mapping_unresolved_invoice",
  /** The contact found for a reference is not of the type the document needs. */
  contactNotCustomer: "zoho_books_contact_not_customer",
  contactNotVendor: "zoho_books_contact_not_vendor",
  /**
   * An invoice LAX numbered (Shop `LAX-INV-…`) that Books holds under another number: the books
   * and the buyer's copy would disagree on the invoice's number, so a person decides.
   */
  numberDiffers: "zoho_books_number_differs",
  /** The payment already applies another amount to the invoice its remainder was meant for. */
  remainderDiffers: "zoho_books_remainder_differs",
  /** The payment no longer holds enough unapplied to pay the invoice (applied elsewhere by hand). */
  remainderUnavailable: "zoho_books_remainder_unavailable",
  /** A payment Books holds under our reference differs from ours (invoice, amount, currency, date). */
  paymentMismatch: "zoho_books_payment_mismatch",
  /**
   * Books holds a document under our reference, but what it should be checked against could not
   * be worked out (one of its dependencies is missing, or the request could not be built), so it
   * cannot be confirmed as ours: a person decides. Followed by the reason it could not be.
   */
  readBackUnconfirmed: "zoho_books_read_back_unconfirmed",
  /** Asked for the PDF of a document that is not an issued invoice or credit note. */
  pdfNotAvailable: "zoho_books_pdf_not_available",
  /**
   * The Books PDF endpoint answers with bytes, and the Books client reads JSON only. Built with
   * the test-organisation step (a binary read in the transport); until then no PDF is fetched.
   */
  pdfNotBuilt: "zoho_books_pdf_not_built",
} as const;

export type ZohoBooksRejection = (typeof ZOHO_BOOKS_REJECTIONS)[keyof typeof ZOHO_BOOKS_REJECTIONS];
