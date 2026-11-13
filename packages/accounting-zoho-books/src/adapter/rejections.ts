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
  /** A payment Books holds under our reference differs from ours (invoice, amount, currency, date). */
  paymentMismatch: "zoho_books_payment_mismatch",
} as const;

export type ZohoBooksRejection = (typeof ZOHO_BOOKS_REJECTIONS)[keyof typeof ZOHO_BOOKS_REJECTIONS];
