import type { ErrorEvent, TransactionEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  scrubSentryEvent,
  scrubSentryTransaction,
  shouldDropBrowserExtensionNoise,
  shouldDropInfrastructureNoise,
  shouldDropSentryEvent,
  shouldDropThirdPartyClientNoise,
} from "./sentry-shared.js";

function errorEvent(partial: Omit<Partial<ErrorEvent>, "type">): ErrorEvent {
  return { type: undefined, ...partial };
}

function transactionEvent(partial: Omit<Partial<TransactionEvent>, "type">): TransactionEvent {
  return { type: "transaction", ...partial };
}

describe("scrubSentryEvent", () => {
  it("removes sensitive request headers", () => {
    const event = errorEvent({
      request: {
        headers: {
          authorization: "Bearer secret",
          cookie: "session=abc",
          "set-cookie": "token=xyz",
          "x-api-key": "key",
          "x-cron-secret": "cron",
          "content-type": "application/json",
        },
      },
    });

    const result = scrubSentryEvent(event);

    expect(result?.request?.headers).toEqual({ "content-type": "application/json" });
  });

  it("drops request body on webhook and internal cron paths", () => {
    for (const url of [
      "https://api.lax.bid/webhooks/stripe/connect",
      "https://api.lax.bid/internal/jobs/sentry-test",
    ]) {
      const event = errorEvent({
        request: {
          url,
          data: { secret: "payload" },
          headers: { "content-type": "application/json" },
        },
      });

      const result = scrubSentryEvent(event);

      expect(result?.request?.data).toBeUndefined();
      expect(result?.request?.url).toBe(url);
    }
  });

  it("keeps request body on non-sensitive paths", () => {
    const event = errorEvent({
      request: {
        url: "https://api.lax.bid/api/lots/123",
        data: { lotId: "123" },
        headers: { "content-type": "application/json" },
      },
    });

    const result = scrubSentryEvent(event);

    expect(result?.request?.data).toEqual({ lotId: "123" });
  });

  it("drops web-vitals captureMessage noise", () => {
    const event = errorEvent({ message: "web-vitals.LCP" });
    expect(scrubSentryEvent(event)).toBeNull();
  });

  it("drops Better Auth invalid password console errors on sign-in routes", () => {
    const event = errorEvent({
      logger: "console",
      message: "2026-05-25T20:42:19.886Z ERROR [Better Auth]: Invalid password",
      transaction: "POST /api/auth/sign-in/email",
    });
    expect(scrubSentryEvent(event)).toBeNull();
  });

  it("keeps unexpected API errors on sign-in routes", () => {
    const event = errorEvent({
      logger: "console",
      message: "database connection failed",
      transaction: "POST /api/auth/sign-in/email",
    });
    expect(scrubSentryEvent(event)).not.toBeNull();
  });
});

describe("shouldDropBrowserExtensionNoise", () => {
  it("drops unmapped parentNode errors from app:/// stacks", () => {
    const event = errorEvent({
      message: "Cannot read properties of null (reading 'parentNode')",
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ filename: "app:///:2:289996" }],
            },
          },
        ],
      },
    });
    expect(shouldDropBrowserExtensionNoise(event)).toBe(true);
  });

  it("keeps first-party errors with mapped source files", () => {
    const event = errorEvent({
      message: "Cannot read properties of null (reading 'parentNode')",
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ filename: "webpack:///_next/static/chunks/app/page.js" }],
            },
          },
        ],
      },
    });
    expect(shouldDropBrowserExtensionNoise(event)).toBe(false);
  });

  it("drops JSON-LD extension eval errors", () => {
    const event = errorEvent({
      message: `undefined is not an object (evaluating 'r["@context"].toLowerCase')`,
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ abs_path: "app:///dashboard/seller:3:362" }],
            },
          },
        ],
      },
    });
    expect(shouldDropBrowserExtensionNoise(event)).toBe(true);
  });
});

describe("shouldDropSentryEvent", () => {
  it("drops state mismatch on OAuth callback", () => {
    const event = errorEvent({
      logger: "console",
      message: "BetterAuthError: State mismatch: verification not found",
      transaction: "GET /api/auth/callback/google",
    });
    expect(shouldDropSentryEvent(event)).toBe(true);
  });

  it("drops state mismatch when message is only in console capture arguments", () => {
    const event = errorEvent({
      logger: "console",
      transaction: "GET /api/auth/callback/google",
      extra: {
        arguments: [
          "[Filtered]",
          {
            code: "state_mismatch",
            message: "State mismatch: verification not found",
          },
        ],
      },
    });
    expect(shouldDropSentryEvent(event)).toBe(true);
  });
});

describe("shouldDropThirdPartyClientNoise", () => {
  it("drops GTM server-side container fetch failures", () => {
    const event = errorEvent({
      message: "TypeError: Failed to fetch (gtm.lax.bid)",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops GTM Load failed rejections", () => {
    const event = errorEvent({
      message: "TypeError: Load failed (gtm.lax.bid)",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops Android WebView bridge errors", () => {
    const event = errorEvent({
      message: "Error: Error invoking callWebView: Java object is gone",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops Facebook in-app browser autofill errors", () => {
    const event = errorEvent({
      message: "TypeError: Cannot read properties of undefined (reading 'value')",
      transaction: "/dashboard/settings/addresses",
      contexts: { browser: { name: "Facebook 562.0.0" } },
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ filename: "app://autofill_contact_enhanced:37:33405" }],
            },
          },
        ],
      },
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops React DOM removeChild NotFoundError", () => {
    const event = errorEvent({
      message: "NotFoundError: The object can not be found here.",
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ function: "removeChild" }],
            },
          },
        ],
      },
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops generic client network Load failed errors", () => {
    const event = errorEvent({
      message: "TypeError: Load failed",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops Instagram in-app browser bridge errors", () => {
    const event = errorEvent({
      message: "TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers')",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("drops stale Next.js server action errors after deploy", () => {
    const event = errorEvent({
      message:
        'UnrecognizedActionError: Server Action "40c1678acd9e71b377f83bba4fa218029459887ea1" was not found on the server.',
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(true);
  });

  it("keeps first-party application errors", () => {
    const event = errorEvent({
      message: "TypeError: Cannot read properties of undefined (reading 'id')",
    });
    expect(shouldDropThirdPartyClientNoise(event)).toBe(false);
  });
});

describe("shouldDropInfrastructureNoise", () => {
  it("drops Redis connect ETIMEDOUT", () => {
    const event = errorEvent({ message: "Error: connect ETIMEDOUT" });
    expect(shouldDropInfrastructureNoise(event)).toBe(true);
    expect(scrubSentryEvent(event)).toBeNull();
  });

  it("drops BullMQ missing lock errors", () => {
    const event = errorEvent({
      message: "Error: Missing lock for job repeat:abc:123. moveToFinished",
    });
    expect(shouldDropInfrastructureNoise(event)).toBe(true);
  });

  it("drops Postgres connection slot exhaustion", () => {
    const event = errorEvent({
      message:
        "error: remaining connection slots are reserved for roles with the SUPERUSER attribute",
    });
    expect(shouldDropInfrastructureNoise(event)).toBe(true);
  });

  it("keeps unexpected application errors", () => {
    const event = errorEvent({ message: "Error: lot not found" });
    expect(shouldDropInfrastructureNoise(event)).toBe(false);
  });
});

describe("scrubSentryTransaction", () => {
  it("removes sensitive headers from transactions", () => {
    const event = transactionEvent({
      request: {
        headers: {
          authorization: "Bearer secret",
          accept: "application/json",
        },
      },
    });

    scrubSentryTransaction(event);

    expect(event.request?.headers).toEqual({ accept: "application/json" });
  });
});
