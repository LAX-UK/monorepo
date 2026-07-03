import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

function cronApp(
  container: Partial<Container>,
  env: Partial<Env> & { CRON_INTERNAL_SECRET: string },
) {
  const { CRON_INTERNAL_SECRET, ...restEnv } = env;
  const fullEnv = {
    LOG_LEVEL: "error",
    NODE_ENV: "test",
    ...restEnv,
    CRON_INTERNAL_SECRET,
  } as Env;
  return new Hono().route(
    "/internal/jobs",
    createInternalCronRoutes(container as Container, fullEnv),
  );
}

describe("POST /internal/jobs/expire-stale-payments", () => {
  it("returns 503 when CRON_INTERNAL_SECRET is unset", async () => {
    const paymentMaintenanceCronService = { expireStalePayments: vi.fn() };
    const env = { CRON_INTERNAL_SECRET: "" } as Env;
    const app = new Hono().route(
      "/internal/jobs",
      createInternalCronRoutes({ paymentMaintenanceCronService } as unknown as Container, env),
    );
    const res = await app.request("/internal/jobs/expire-stale-payments", {
      method: "POST",
      headers: { "x-cron-secret": "x" },
    });
    expect(res.status).toBe(503);
    expect(paymentMaintenanceCronService.expireStalePayments).not.toHaveBeenCalled();
  });

  it("returns 401 for a bad cron secret", async () => {
    const paymentMaintenanceCronService = { expireStalePayments: vi.fn() };
    const app = cronApp({ paymentMaintenanceCronService } as unknown as Container, {
      CRON_INTERNAL_SECRET: "good",
    });
    const res = await app.request("/internal/jobs/expire-stale-payments", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    expect(res.status).toBe(401);
    expect(paymentMaintenanceCronService.expireStalePayments).not.toHaveBeenCalled();
  });

  it("returns expired count from paymentService", async () => {
    const paymentMaintenanceCronService = {
      expireStalePayments: vi.fn(async () => ({ expired: 5 })),
    };
    const app = cronApp({ paymentMaintenanceCronService } as unknown as Container, {
      CRON_INTERNAL_SECRET: "secret",
      PAYMENT_PENDING_EXPIRE_DAYS: 14,
      PAYMENT_AUTHORIZED_EXPIRE_DAYS: 30,
    });
    const res = await app.request("/internal/jobs/expire-stale-payments", {
      method: "POST",
      headers: { "x-cron-secret": "secret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { expired: 5 } });
    expect(paymentMaintenanceCronService.expireStalePayments).toHaveBeenCalledWith(14, 30);
  });
});

describe("POST /internal/jobs/retry-xero-webhook-failures", () => {
  it("returns 401 without valid cron secret", async () => {
    const app = cronApp(
      {
        accountingReplayCronService: { retryXeroWebhookFailures: vi.fn() },
      } as unknown as Container,
      { CRON_INTERNAL_SECRET: "s" },
    );
    const res = await app.request("/internal/jobs/retry-xero-webhook-failures", {
      method: "POST",
      headers: { "x-cron-secret": "nope" },
    });
    expect(res.status).toBe(401);
  });

  it("replays failures and counts recovered rows", async () => {
    const retryXeroWebhookFailures = vi.fn(async () => ({ attempted: 2, recovered: 1 }));

    const app = cronApp(
      {
        accountingReplayCronService: { retryXeroWebhookFailures },
      } as unknown as Container,
      { CRON_INTERNAL_SECRET: "cron" },
    );

    const res = await app.request("/internal/jobs/retry-xero-webhook-failures", {
      method: "POST",
      headers: { "x-cron-secret": "cron" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { attempted: 2, recovered: 1 } });
    expect(retryXeroWebhookFailures).toHaveBeenCalled();
  });
});

describe("POST /internal/jobs/sentry-test", () => {
  it("returns 503 when SENTRY_DSN_API is unset", async () => {
    const app = cronApp(
      {
        hygieneCronService: {
          probeSentry: vi.fn(async () => ({ ok: false, error: "sentry_not_configured" })),
        },
      } as unknown as Container,
      {
        CRON_INTERNAL_SECRET: "secret",
      },
    );
    const res = await app.request("/internal/jobs/sentry-test", {
      method: "POST",
      headers: { "x-cron-secret": "secret" },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "sentry_not_configured" });
  });

  it("returns ok with an event id when Sentry is configured", async () => {
    const app = cronApp(
      {
        hygieneCronService: {
          probeSentry: vi.fn(async () => ({ ok: true, eventId: "test-event-id" })),
        },
      } as unknown as Container,
      {
        CRON_INTERNAL_SECRET: "secret",
        SENTRY_DSN_API: "https://example@sentry.io/1",
      },
    );
    const res = await app.request("/internal/jobs/sentry-test", {
      method: "POST",
      headers: { "x-cron-secret": "secret" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; eventId: string };
    expect(body.ok).toBe(true);
    expect(body.eventId).toBe("test-event-id");
  });
});
