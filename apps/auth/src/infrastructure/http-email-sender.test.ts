import { describe, expect, it, vi } from "vitest";
import {
  HttpEmailSender,
  type HttpEmailSenderOptions,
  IdentityEmailEnqueueError,
} from "./http-email-sender.js";

const input = {
  template: "verify-email",
  to: "subject@example.com",
  userId: "subject-1",
  vars: { verificationUrl: "https://auth.example.com/verify" },
  category: "auth",
} as const;

function createSender(fetch: HttpEmailSenderOptions["fetch"], overrides = {}) {
  return new HttpEmailSender({
    baseUrl: "http://api.internal/",
    clientId: "auth-service",
    clientSecret: "identity-machine-secret-at-least-32-characters",
    timeoutMs: 20,
    fetch,
    ...overrides,
  });
}

describe("HttpEmailSender", () => {
  it("posts machine-authenticated Identity email intents", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { outboxId: "outbox-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const sender = createSender(fetch);

    await expect(sender.enqueue(input)).resolves.toEqual({ outboxId: "outbox-1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.internal/internal/identity/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-identity-client-id": "auth-service",
          "x-identity-client-secret": "identity-machine-secret-at-least-32-characters",
        },
        body: JSON.stringify(input),
      }),
    );
  });

  it("retries one retryable server failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { outboxId: "outbox-2" } }), { status: 201 }),
      );

    await expect(createSender(fetch).enqueue(input)).resolves.toEqual({ outboxId: "outbox-2" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure once", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { outboxId: "outbox-3" } }), { status: 201 }),
      );

    await expect(createSender(fetch).enqueue(input)).resolves.toEqual({ outboxId: "outbox-3" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication or validation failures", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await expect(createSender(fetch).enqueue(input)).rejects.toMatchObject({
      code: "rejected",
      status: 401,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reports a stable timeout after both attempts expire", async () => {
    const fetch = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    await expect(createSender(fetch as never).enqueue(input)).rejects.toEqual(
      new IdentityEmailEnqueueError("timeout"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed success responses and missing credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 201 }));
    await expect(createSender(fetch).enqueue(input)).rejects.toMatchObject({
      code: "invalid_response",
    });

    await expect(
      createSender(fetch, { clientSecret: undefined }).enqueue(input),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
