import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { createPostmarkInboundWebhookRoutes } from "./postmark-inbound.js";

const CREDENTIALS = "inbound-user:inbound-password-123";
const basic = (value: string) => `Basic ${Buffer.from(value, "utf8").toString("base64")}`;

function setup(env: Record<string, unknown> = {}) {
  const handle = vi.fn().mockResolvedValue({ outcome: "stored", messageId: "m", enquiryId: "e" });
  const container = {
    env: {
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
      ENQUIRY_INBOUND_REPLIES_ENABLED: true,
      POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH: CREDENTIALS,
      ...env,
    },
    enquiryInboundReplies: env.ENQUIRY_INBOUND_REPLIES_ENABLED === false ? null : { handle },
  } as unknown as Container;
  const app = new Hono().route(
    "/webhooks/postmark/inbound",
    createPostmarkInboundWebhookRoutes(container),
  );
  const post = (headers: Record<string, string>, body: unknown = { MessageID: "pm-1" }) =>
    app.request("/webhooks/postmark/inbound", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  return { post, handle };
}

describe("Postmark inbound webhook", () => {
  it("refuses a request with no credentials, wrong credentials or the wrong scheme", async () => {
    const { post, handle } = setup();
    expect((await post({})).status).toBe(401);
    expect((await post({ authorization: basic("inbound-user:wrong-password-1") })).status).toBe(
      401,
    );
    expect((await post({ authorization: basic("other:inbound-password-123") })).status).toBe(401);
    expect((await post({ authorization: `Bearer ${CREDENTIALS}` })).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("does not accept the delivery webhook's credentials", async () => {
    const { post, handle } = setup({ POSTMARK_WEBHOOK_BASIC_AUTH: "delivery:secret-delivery-1" });
    expect((await post({ authorization: basic("delivery:secret-delivery-1") })).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("accepts the configured credentials and hands the mail to the service", async () => {
    const { post, handle } = setup();
    const res = await post({ authorization: basic(CREDENTIALS) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: "stored" });
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ MessageID: "pm-1" }));
  });

  it("does not exist while the flag is off, and never runs open without a secret", async () => {
    const off = setup({ ENQUIRY_INBOUND_REPLIES_ENABLED: false });
    expect((await off.post({ authorization: basic(CREDENTIALS) })).status).toBe(404);
    const open = setup({ POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH: undefined });
    expect((await open.post({})).status).toBe(503);
    expect(open.handle).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized bodies after authenticating", async () => {
    const { post, handle } = setup();
    const authorization = basic(CREDENTIALS);
    expect((await post({ authorization }, "not json")).status).toBe(400);
    expect((await post({ authorization }, { Subject: "no message id" })).status).toBe(400);
    expect((await post({ authorization, "content-length": String(41 * 1024 * 1024) })).status).toBe(
      413,
    );
    expect(handle).not.toHaveBeenCalled();
  });
});
