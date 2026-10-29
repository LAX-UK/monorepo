/** The largest document a member can send, as the upload service allows. */
export const ORGANISATION_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

/** What the file picker offers: PDFs and photos. */
export const ORGANISATION_DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export const ORGANISATION_DOCUMENT_FORMATS = "PDF, JPG or PNG, up to 15 MB.";

const FALLBACK = "We couldn't send this document. Try again.";

/** Each refusal from the documents API, said so a member knows what to do next. */
const UPLOAD_ERROR_COPY: Record<string, string> = {
  file_too_large: "This file is over 15 MB. Send a smaller copy.",
  forbidden: "Only owners and admins can send documents.",
  entity_not_editable:
    "Documents can't be changed while we check them. We'll ask if we need anything new.",
  duplicate_upload: "This file has already been sent.",
  upload_not_ready: "The file is still uploading. Wait a moment, then try again.",
  upload_not_found: FALLBACK,
  upload_kind_mismatch: FALLBACK,
  other_document_label_required: FALLBACK,
  not_found: FALLBACK,
};

/** The words for an upload refusal; never a raw code. */
export function organisationDocumentUploadError(code: string | null | undefined): string {
  return (code && UPLOAD_ERROR_COPY[code]) || FALLBACK;
}
