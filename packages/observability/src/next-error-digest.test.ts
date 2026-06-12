import type { ErrorEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
  enrichSentryEventWithNextDigest,
  isRedactedNextRscClientError,
  readNextErrorDigest,
  shouldDropUnactionableRedactedRscClientError,
} from "./next-error-digest.js";

function errorEvent(partial: Omit<Partial<ErrorEvent>, "type">): ErrorEvent {
  return { type: undefined, ...partial };
}

describe("readNextErrorDigest", () => {
  it("reads string and numeric digests", () => {
    expect(readNextErrorDigest({ digest: "3880181482" })).toBe("3880181482");
    expect(readNextErrorDigest({ digest: 3880181482 })).toBe("3880181482");
  });

  it("returns undefined for missing digests", () => {
    expect(readNextErrorDigest(null)).toBeUndefined();
    expect(readNextErrorDigest(new Error("boom"))).toBeUndefined();
  });
});

describe("enrichSentryEventWithNextDigest", () => {
  it("tags, fingerprints, and preserves server error messages", () => {
    const event = errorEvent({
      message: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
      exception: {
        values: [{ type: "Error", value: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX }],
      },
    });
    const original = Object.assign(new RangeError("Invalid time value"), {
      digest: "3880181482",
    });

    const enriched = enrichSentryEventWithNextDigest(event, { originalException: original });

    expect(enriched.tags?.["next.digest"]).toBe("3880181482");
    expect(enriched.fingerprint).toEqual(["next-rsc", "3880181482"]);
    expect(enriched.contexts?.nextjs_error).toEqual({
      digest: "3880181482",
      name: "RangeError",
      message: "Invalid time value",
    });
    expect(enriched.exception?.values?.[0]?.value).toBe("Invalid time value");
  });
});

describe("shouldDropUnactionableRedactedRscClientError", () => {
  it("drops redacted client wrappers without a digest", () => {
    const event = errorEvent({
      message: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
      exception: {
        values: [
          {
            type: "Error",
            value: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
            mechanism: { type: "generic", handled: true },
          },
        ],
      },
    });
    expect(shouldDropUnactionableRedactedRscClientError(event)).toBe(true);
  });

  it("keeps digest-tagged and server onRequestError events", () => {
    const tagged = errorEvent({
      message: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
      tags: { "next.digest": "3880181482" },
    });
    const server = errorEvent({
      message: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
      exception: {
        values: [
          {
            type: "Error",
            value: REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX,
            mechanism: { type: "auto.function.nextjs.on_request_error", handled: false },
          },
        ],
      },
    });
    expect(shouldDropUnactionableRedactedRscClientError(tagged)).toBe(false);
    expect(shouldDropUnactionableRedactedRscClientError(server)).toBe(false);
  });
});

describe("isRedactedNextRscClientError", () => {
  it("matches the Next.js production wrapper prefix", () => {
    expect(isRedactedNextRscClientError(REDACTED_NEXT_RSC_CLIENT_ERROR_PREFIX)).toBe(true);
    expect(isRedactedNextRscClientError("RangeError: Invalid time value")).toBe(false);
  });
});
