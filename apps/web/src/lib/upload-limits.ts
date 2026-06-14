/** Mirrors `uploadPolicies.source_of_funds_document.maxBytes` in the API. */
export const SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export function formatUploadMaxSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

export function validateSourceOfFundsFileSize(file: File): string | null {
  if (file.size > SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES) {
    return `File is too large (max ${formatUploadMaxSize(SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES)})`;
  }
  return null;
}

export function isImageFileName(fileName: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(fileName);
}
