import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { createPostmarkInboundWebhookRoutes } from "./postmark-inbound.js";

const CREDENTIALS = "inbound-user:inbound-password-123";
const basic = (value: string) => `Basic ${Buffer.from(value, "utf8").toString("base64")}`;

function setup(
  env: Record<string, unknown> = {},
  options: { service?: "present" | "absent"; maxBytes?: number } = {},
) {
  const handle = vi.fn().mockResolvedValue({ outcome: "stored", messageId: "m", enquiryId: "e" });
  const container = {
    env: {
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
      ENQUIRY_INBOUND_REPLIES_ENABLED: true,
      POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH: CREDENTIALS,
      ...env,
    },
    enquiryInboundReplies:
      options.service === "absent" ||
      (options.service === undefined && env.ENQUIRY_INBOUND_REPLIES_ENABLED === false)
        ? null
        : { handle },
  } as unknown as Container;
  const app = new Hono().route(
    "/webhooks/postmark/inbound",
    createPostmarkInboundWebhookRoutes(
      container,
      options.maxBytes ? { maxBytes: options.maxBytes } : {},
    ),
  );
  const post = (
    headers: Record<string, string>,
    body: unknown = { MessageID: "pm-1" },
  ): Promise<Response> =>
    Promise.resolve().then(() =>
      app.request("/webhooks/postmark/inbound", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body:
          body instanceof ReadableStream
            ? body
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
        ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
      } as RequestInit),
    );
  return { post, handle };
}

/** A body sent in chunks with no Content-Length, as a chunked request arrives. */
function chunked(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const part = parts[index];
      index += 1;
      if (part === undefined) controller.close();
      else controller.enqueue(encoder.encode(part));
    },
  });
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

  it("checks the flag itself: a service wired with the flag off still answers 404", async () => {
    const { post, handle } = setup(
      { ENQUIRY_INBOUND_REPLIES_ENABLED: false },
      { service: "present" },
    );
    expect((await post({ authorization: basic(CREDENTIALS) })).status).toBe(404);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 404 with the flag on but no service wired", async () => {
    const { post, handle } = setup({}, { service: "absent" });
    expect((await post({ authorization: basic(CREDENTIALS) })).status).toBe(404);
    expect(handle).not.toHaveBeenCalled();
  });

  it("stops reading a chunked body without a Content-Length once it passes the cap", async () => {
    const { post, handle } = setup({}, { maxBytes: 64 });
    const authorization = basic(CREDENTIALS);
    const big = chunked(['{"MessageID":"pm-1","TextBody":"', "x".repeat(40), "y".repeat(40), '"}']);
    expect((await post({ authorization }, big)).status).toBe(413);
    const small = chunked(['{"MessageID":', '"pm-2"}']);
    expect((await post({ authorization }, small)).status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ MessageID: "pm-2" }));
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
