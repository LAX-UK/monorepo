import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { zohoBooksSignature } from "../lib/zoho-books-notice-signature.js";
import {
  ZOHO_BOOKS_NOTICE_MAX_BYTES,
  ZohoBooksNoticeIngressApplicationService,
} from "../services/finance/zoho-books-notice-ingress-application.service.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createZohoBooksWebhookRoutes } from "./zoho-books-webhook.js";

const SECRET = "books-notice-test-secret-0123456789abcdef"; // gitleaks:allow
const BODY = JSON.stringify({
  organization_id: "20091234567",
  module: "creditnote",
  entity_id: "5000000000777",
  event_time: new Date().toISOString(),
});

const allow: IRateLimitStore = { increment: vi.fn(async () => ({ allowed: true, remaining: 99 })) };

function appWith(secret: string | undefined, rateLimitStore: IRateLimitStore = allow) {
  const claims: string[] = [];
  const alerts = { signatureFailed: vi.fn() };
  const service = new ZohoBooksNoticeIngressApplicationService(
    secret,
    {
      tryClaimEvent: async ({ eventKey }: { eventKey: string }) => {
        const claimed = !claims.includes(eventKey);
        if (claimed) claims.push(eventKey);
        return { claimed };
      },
    } as never,
    null,
    alerts,
  );
  const app = new Hono().route(
    "/webhooks",
    createZohoBooksWebhookRoutes({ finance: { zohoBooksNotices: service } } as never, {
      rateLimitStore,
    }),
  );
  return { app, claims, alerts };
}

const post = (app: Hono, signature: string | null, query = "?source=books", body = BODY) =>
  app.request(`/webhooks/zoho-books/notices${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "X-Zoho-Webhook-Signature": signature } : {}),
    },
    body,
  });

describe("POST /webhooks/zoho-books/notices", () => {
  it("accepts a notice signed over its query parameters and raw body", async () => {
    const { app, claims } = appWith(SECRET);
    const res = await post(app, zohoBooksSignature([["source", "books"]], BODY, SECRET));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(claims).toHaveLength(1);
  });

  it("refuses a signature made without the query parameters", async () => {
    const { app, claims, alerts } = appWith(SECRET);
    const res = await post(app, zohoBooksSignature([], BODY, SECRET));
    expect(res.status).toBe(401);
    expect(alerts.signatureFailed).toHaveBeenCalledWith({ reason: "invalid" });
    expect(claims).toEqual([]);
  });

  it("every refusal has no body and is never cached", async () => {
    for (const [secret, signature, status] of [
      [undefined, zohoBooksSignature([["source", "books"]], BODY, SECRET), 503],
      [SECRET, null, 401],
      [SECRET, "Zm9vYmFy", 401],
    ] as const) {
      const { app } = appWith(secret);
      const res = await post(app, signature);
      expect(res.status).toBe(status);
      expect(await res.text()).toBe("");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("refuses a body over 16 KiB before reading it: the service is never asked", async () => {
    const { app, claims, alerts } = appWith(SECRET);
    const big = JSON.stringify({ pad: "x".repeat(ZOHO_BOOKS_NOTICE_MAX_BYTES) });
    const handle = vi.spyOn(ZohoBooksNoticeIngressApplicationService.prototype, "handle");
    try {
      const res = await post(
        app,
        zohoBooksSignature([["source", "books"]], big, SECRET),
        "?source=books",
        big,
      );
      expect(res.status).toBe(413);
      expect(await res.text()).toBe("");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(handle).not.toHaveBeenCalled();
    } finally {
      handle.mockRestore();
    }
    expect(claims).toEqual([]);
    expect(alerts.signatureFailed).not.toHaveBeenCalled();
  });

  it("refuses a body that streams past 16 KiB with no length declared", async () => {
    const { app, claims } = appWith(SECRET);
    const chunk = new TextEncoder().encode("x".repeat(4 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 8) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const handle = vi.spyOn(ZohoBooksNoticeIngressApplicationService.prototype, "handle");
    try {
      const res = await app.request("/webhooks/zoho-books/notices?source=books", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Zoho-Webhook-Signature": "AAAA" },
        body: stream,
        duplex: "half",
      } as RequestInit);
      expect(res.status).toBe(413);
      // Refused as it streamed in: never buffered whole and handed to the service.
      expect(handle).not.toHaveBeenCalled();
      expect(sent).toBeLessThan(8);
    } finally {
      handle.mockRestore();
    }
    expect(claims).toEqual([]);
  });

  it("is rate limited per client before anything is read or alerted", async () => {
    const deny: IRateLimitStore = {
      increment: vi.fn(async () => ({ allowed: false, remaining: 0, retryAfterSec: 30 })),
    };
    const { app, claims, alerts } = appWith(SECRET, deny);
    const handle = vi.spyOn(ZohoBooksNoticeIngressApplicationService.prototype, "handle");
    try {
      const res = await post(app, null);
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("30");
      expect(handle).not.toHaveBeenCalled();
    } finally {
      handle.mockRestore();
    }
    expect(alerts.signatureFailed).not.toHaveBeenCalled();
    expect(claims).toEqual([]);
    expect(deny.increment).toHaveBeenCalledWith(
      expect.stringContaining("/webhooks/zoho-books/notices"),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
