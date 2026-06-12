import { readNextErrorDigest } from "@auction/observability/next-error-digest";
import * as Sentry from "@sentry/nextjs";

type RequestInfo = Parameters<typeof Sentry.captureRequestError>[1];
type ErrorContext = Parameters<typeof Sentry.captureRequestError>[2];

/**
 * Next.js `onRequestError` hook with digest tags for correlating prod RSC failures
 * to server logs (`digest: '…'` in container output).
 */
export function captureWebRequestError(
  error: unknown,
  request: RequestInfo,
  errorContext: ErrorContext,
): void {
  Sentry.withScope((scope) => {
    const digest = readNextErrorDigest(error);
    if (digest) {
      scope.setTag("next.digest", digest);
      scope.setTag("next.error_source", "server");
    }
    Sentry.captureRequestError(error, request, errorContext);
  });
}
