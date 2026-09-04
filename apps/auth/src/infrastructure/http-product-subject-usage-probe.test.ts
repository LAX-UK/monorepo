import { describe, expect, it, vi } from "vitest";
import {
  HttpProductSubjectUsageProbe,
  type HttpProductSubjectUsageProbeOptions,
  ProductSubjectUsageUnavailableError,
} from "./http-product-subject-usage-probe.js";

function createProbe(fetch: HttpProductSubjectUsageProbeOptions["fetch"], overrides = {}) {
  return new HttpProductSubjectUsageProbe({
    baseUrl: "http://api.internal/",
    clientId: "auth-service",
    clientSecret: "identity-machine-secret-at-least-32-characters",
    timeoutMs: 20,
    fetch,
    ...overrides,
  });
}

describe("HttpProductSubjectUsageProbe", () => {
  it("gets both usage flags through the machine-authenticated boundary", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { hasProductProfile: true, hasExternalLink: false },
        }),
        { status: 200 },
      ),
    );

    await expect(createProbe(fetch).getSubjectUsage("subject/1")).resolves.toEqual({
      hasProductProfile: true,
      hasExternalLink: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.internal/internal/identity/subject-usage/subject%2F1",
      expect.objectContaining({
        method: "GET",
        headers: {
          "x-identity-client-id": "auth-service",
          "x-identity-client-secret": "identity-machine-secret-at-least-32-characters",
        },
      }),
    );
  });

  it("retries one server or network failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("connection refused"));

    await expect(createProbe(fetch).getSubjectUsage("subject-1")).rejects.toEqual(
      new ProductSubjectUsageUnavailableError("network"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry rejected requests", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await expect(createProbe(fetch).getSubjectUsage("subject-1")).rejects.toMatchObject({
      code: "rejected",
      status: 401,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects malformed responses and missing credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { hasProductProfile: false } }), { status: 200 }),
      );
    await expect(createProbe(fetch).getSubjectUsage("subject-1")).rejects.toMatchObject({
      code: "invalid_response",
    });

    await expect(
      createProbe(fetch, { clientSecret: undefined }).getSubjectUsage("subject-1"),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("reports a stable timeout after both attempts expire", async () => {
    const fetch = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    await expect(createProbe(fetch as never).getSubjectUsage("subject-1")).rejects.toEqual(
      new ProductSubjectUsageUnavailableError("timeout"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
