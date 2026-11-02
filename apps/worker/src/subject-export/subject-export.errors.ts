import type { SubjectExportProduct } from "@auction/identity-contracts";

/**
 * Whether trying again can help. A product that does not answer, a link that expired and a full
 * disk are transient; a request the product refuses as malformed or an answer that breaks the
 * contract are not.
 */
export type SubjectExportFailureKind = "transient" | "permanent";

/**
 * A failure while preparing a copy. The code is what Identity records and staff see, so it is a
 * short machine word and never carries record content; the message repeats it for the same reason.
 */
export class SubjectExportError extends Error {
  constructor(
    readonly kind: SubjectExportFailureKind,
    readonly code: string,
    /** The product being collected when it happened, when one was. */
    readonly product?: SubjectExportProduct,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = "SubjectExportError";
  }
}

export function transientError(
  code: string,
  product?: SubjectExportProduct,
  cause?: unknown,
): SubjectExportError {
  return new SubjectExportError("transient", code, product, { cause });
}

export function permanentError(
  code: string,
  product?: SubjectExportProduct,
  cause?: unknown,
): SubjectExportError {
  return new SubjectExportError("permanent", code, product, { cause });
}

/** The same error carrying the product it happened in, unless it already names one. */
export function withProduct(error: SubjectExportError, product: SubjectExportProduct) {
  return error.product
    ? error
    : new SubjectExportError(error.kind, error.code, product, { cause: error });
}

/** 400 and 422 say the request itself is wrong; everything else may pass with time. */
export function kindForStatus(status: number): SubjectExportFailureKind {
  return status === 400 || status === 422 ? "permanent" : "transient";
}

/** Any error as an export error: one that is not already classified is treated as transient. */
export function asSubjectExportError(error: unknown): SubjectExportError {
  if (error instanceof SubjectExportError) return error;
  return transientError(
    error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unexpected_error",
    undefined,
    error,
  );
}
