import type { ErrorEvent, TransactionEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { scrubSentryEvent, scrubSentryTransaction } from "./sentry-shared.js";

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

    scrubSentryEvent(event);

    expect(event.request?.headers).toEqual({ "content-type": "application/json" });
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

      scrubSentryEvent(event);

      expect(event.request?.data).toBeUndefined();
      expect(event.request?.url).toBe(url);
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

    scrubSentryEvent(event);

    expect(event.request?.data).toEqual({ lotId: "123" });
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
    } as TransactionEvent;

    scrubSentryTransaction(event);

    expect(event.request?.headers).toEqual({ accept: "application/json" });
  });
});
