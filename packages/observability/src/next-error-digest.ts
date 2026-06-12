import type { ErrorEvent, EventHint } from "@sentry/core";

export const REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX =
  "An error occurred in the Server Components render";

/** Read the Next.js RSC error digest when present on an thrown value. */
export function readNextErrorDigest(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.length > 0) return digest;
  if (typeof digest === "number" && Number.isFinite(digest)) return String(digest);
  return undefined;
}

export function isRedactedNextRscClientError(message: string): boolean {
  return message.startsWith(REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX);
}

function eventMessage(event: ErrorEvent): string {
  if (typeof event.message === "string" && event.message.length > 0) return event.message;
  if (event.logentry?.message) return event.logentry.message;
  const exceptionValue = event.exception?.values?.[0]?.value;
  if (typeof exceptionValue === "string" && exceptionValue.length > 0) return exceptionValue;
  return "";
}

function mechanismType(event: ErrorEvent): string {
  return event.exception?.values?.[0]?.mechanism?.type ?? "";
}

/** Tag and fingerprint Next.js RSC failures so prod digests are searchable in Sentry. */
export function enrichSentryEventWithNextDigest(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  const original = hint?.originalException;
  const digest = readNextErrorDigest(original);
  if (!digest) return event;

  event.tags = { ...event.tags, "next.digest": digest };

  const originalError = original instanceof Error ? original : null;
  event.contexts = {
    ...event.contexts,
    nextjs_error: {
      digest,
      ...(originalError
        ? {
            name: originalError.name,
            message: originalError.message,
          }
        : {}),
    },
  };

  event.fingerprint = ["next-rsc", digest];

  if (
    originalError?.message &&
    !isRedactedNextRscClientError(originalError.message) &&
    isRedactedNextRscClientError(eventMessage(event))
  ) {
    const values = event.exception?.values;
    const current = values?.[0];
    if (current) {
      values[0] = {
        ...current,
        type: originalError.name || current.type || "Error",
        value: originalError.message,
      };
    }
  }

  return event;
}

/**
 * Drop client-side RSC wrapper errors that hide the root cause and carry no digest.
 * Server `onRequestError` captures and digest-tagged events are kept.
 */
export function shouldDropUnactionableRedactedRscClientError(event: ErrorEvent): boolean {
  if (!isRedactedNextRscClientError(eventMessage(event))) return false;
  if (typeof event.tags?.["next.digest"] === "string") return false;
  if (mechanismType(event) === "auto.function.nextjs.on_request_error") return false;
  return true;
}
