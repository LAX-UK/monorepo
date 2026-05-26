import type { ErrorEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  scrubSentryEvent,
  scrubSentryTransaction,
  shouldDropBrowserExtensionNoise,
  shouldDropSentryEvent,
} from "./sentry-shared.js";

describe("scrubSentryEvent", () => {
  it("removes sensitive request headers", () => {
    const event = {
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
    } as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result?.request?.headers).toEqual({ "content-type": "application/json" });
  });

  it("drops request body on webhook and internal cron paths", () => {
    for (const url of [
      "https://api.lax.bid/webhooks/stripe/connect",
      "https://api.lax.bid/internal/jobs/sentry-test",
    ]) {
      const event = {
        request: {
          url,
          data: { secret: "payload" },
          headers: { "content-type": "application/json" },
        },
      } as ErrorEvent;

      const result = scrubSentryEvent(event);

      expect(result?.request?.data).toBeUndefined();
      expect(result?.request?.url).toBe(url);
    }
  });

  it("keeps request body on non-sensitive paths", () => {
    const event = {
      request: {
        url: "https://api.lax.bid/api/lots/123",
        data: { lotId: "123" },
        headers: { "content-type": "application/json" },
      },
    } as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result?.request?.data).toEqual({ lotId: "123" });
  });

  it("drops web-vitals captureMessage noise", () => {
    const event = { message: "web-vitals.LCP" } as ErrorEvent;
    expect(scrubSentryEvent(event)).toBeNull();
  });

  it("drops Better Auth invalid password console errors on sign-in routes", () => {
    const event = {
      logger: "console",
      message: "2026-05-25T20:42:19.886Z ERROR [Better Auth]: Invalid password",
      transaction: "POST /api/auth/sign-in/email",
    } as ErrorEvent;
    expect(scrubSentryEvent(event)).toBeNull();
  });

  it("keeps unexpected API errors on sign-in routes", () => {
    const event = {
      logger: "console",
      message: "database connection failed",
      transaction: "POST /api/auth/sign-in/email",
    } as ErrorEvent;
    expect(scrubSentryEvent(event)).not.toBeNull();
  });
});

describe("shouldDropBrowserExtensionNoise", () => {
  it("drops unmapped parentNode errors from app:/// stacks", () => {
    const event = {
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
    } as ErrorEvent;
    expect(shouldDropBrowserExtensionNoise(event)).toBe(true);
  });

  it("keeps first-party errors with mapped source files", () => {
    const event = {
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
    } as ErrorEvent;
    expect(shouldDropBrowserExtensionNoise(event)).toBe(false);
  });

  it("drops JSON-LD extension eval errors", () => {
    const event = {
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
    } as ErrorEvent;
    expect(shouldDropBrowserExtensionNoise(event)).toBe(true);
  });
});

describe("shouldDropSentryEvent", () => {
  it("drops state mismatch on OAuth callback", () => {
    const event = {
      logger: "console",
      message: "BetterAuthError: State mismatch: verification not found",
      transaction: "GET /api/auth/callback/google",
    } as ErrorEvent;
    expect(shouldDropSentryEvent(event)).toBe(true);
  });
});

describe("scrubSentryTransaction", () => {
  it("removes sensitive headers from transactions", () => {
    const event = {
      request: {
        headers: {
          authorization: "Bearer secret",
          accept: "application/json",
        },
      },
    } as import("@sentry/core").TransactionEvent;

    scrubSentryTransaction(event);

    expect(event.request?.headers).toEqual({ accept: "application/json" });
  });
});
