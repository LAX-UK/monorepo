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
    const paymentService = { expireStalePendingPayments: vi.fn() };
    const env = { CRON_INTERNAL_SECRET: "" } as Env;
    const app = new Hono().route(
      "/internal/jobs",
      createInternalCronRoutes({ paymentService } as unknown as Container, env),
    );
    const res = await app.request("/internal/jobs/expire-stale-payments", {
      method: "POST",
      headers: { "x-cron-secret": "x" },
    });
    expect(res.status).toBe(503);
    expect(paymentService.expireStalePendingPayments).not.toHaveBeenCalled();
  });

  it("returns 401 for a bad cron secret", async () => {
    const paymentService = { expireStalePendingPayments: vi.fn() };
    const app = cronApp({ paymentService } as unknown as Container, {
      CRON_INTERNAL_SECRET: "good",
    });
    const res = await app.request("/internal/jobs/expire-stale-payments", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    expect(res.status).toBe(401);
    expect(paymentService.expireStalePendingPayments).not.toHaveBeenCalled();
  });

  it("returns expired count from paymentService", async () => {
    const paymentService = { expireStalePendingPayments: vi.fn(async () => 5) };
    const app = cronApp({ paymentService } as unknown as Container, {
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
    expect(paymentService.expireStalePendingPayments).toHaveBeenCalledWith(14, 30);
  });
});

describe("POST /internal/jobs/retry-xero-webhook-failures", () => {
  it("returns 401 without valid cron secret", async () => {
    const app = cronApp(
      {
        xeroWebhookEventRepository: { listRecentFailures: vi.fn() },
        accountingProvider: { syncInvoiceFromProvider: vi.fn() },
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
    const rows = [
      { eventKey: "a", tenantId: "t1", resourceId: "r1" },
      { eventKey: "b", tenantId: "t1", resourceId: "r2" },
    ];
    const listRecentFailures = vi.fn(async () => rows);
    const markProcessed = vi.fn();
    const markFailed = vi.fn();
    const syncInvoiceFromProvider = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "xero_down" });

    const app = cronApp(
      {
        xeroWebhookEventRepository: {
          listRecentFailures,
          markProcessed,
          markFailed,
        },
        accountingProvider: { syncInvoiceFromProvider },
      } as unknown as Container,
      { CRON_INTERNAL_SECRET: "cron" },
    );

    const res = await app.request("/internal/jobs/retry-xero-webhook-failures", {
      method: "POST",
      headers: { "x-cron-secret": "cron" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { attempted: 2, recovered: 1 } });
    expect(syncInvoiceFromProvider).toHaveBeenNthCalledWith(1, "t1", "r1");
    expect(syncInvoiceFromProvider).toHaveBeenNthCalledWith(2, "t1", "r2");
    expect(markProcessed).toHaveBeenCalledWith("a");
    expect(markFailed).toHaveBeenCalledWith("b", "xero_down");
  });
});

describe("POST /internal/jobs/sentry-test", () => {
  it("returns 503 when SENTRY_DSN_API is unset", async () => {
    const app = cronApp({} as unknown as Container, {
      CRON_INTERNAL_SECRET: "secret",
    });
    const res = await app.request("/internal/jobs/sentry-test", {
      method: "POST",
      headers: { "x-cron-secret": "secret" },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "sentry_not_configured" });
  });

  it("returns ok with an event id when Sentry is configured", async () => {
    const app = cronApp({} as unknown as Container, {
      CRON_INTERNAL_SECRET: "secret",
      SENTRY_DSN_API: "https://example@sentry.io/1",
    });
    const res = await app.request("/internal/jobs/sentry-test", {
      method: "POST",
      headers: { "x-cron-secret": "secret" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; eventId: string };
    expect(body.ok).toBe(true);
    expect(typeof body.eventId).toBe("string");
    expect(body.eventId.length).toBeGreaterThan(0);
  });
});
