import { describe, expect, it, vi } from "vitest";
import {
  HttpProductDeletionEligibilityProbe,
  ProductDeletionEligibilityUnavailableError,
} from "./http-product-deletion-eligibility-probe.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const BLOCKER = { code: "pay", message: "Pay the invoice.", href: "https://bid.example/pay" };

function probe(
  respond: (url: string, init: RequestInit) => Promise<Response>,
  overrides: Partial<ConstructorParameters<typeof HttpProductDeletionEligibilityProbe>[0]> = {},
) {
  const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    respond(String(input), init ?? {}),
  );
  return {
    fetchImpl,
    probe: new HttpProductDeletionEligibilityProbe({
      baseUrls: { bid: "https://bid.internal/", shop: "https://shop.internal" },
      clientId: "api-service",
      clientSecret: "machine-secret",
      timeoutMs: 50,
      fetch: fetchImpl as never,
      ...overrides,
    }),
  };
}

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as ProductDeletionEligibilityUnavailableError,
  );

describe("HttpProductDeletionEligibilityProbe", () => {
  it("asks the product's own base URL with the machine credentials", async () => {
    const { probe: p, fetchImpl } = probe(async () =>
      Response.json({ product: "shop", blockers: [BLOCKER] }),
    );
    expect(await p.check("shop", SUBJECT)).toEqual({ product: "shop", blockers: [BLOCKER] });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://shop.internal/internal/identity/subjects/${SUBJECT}/deletion-eligibility`,
    );
    expect(init.headers).toEqual({
      "x-identity-client-id": "api-service",
      "x-identity-client-secret": "machine-secret",
    });
  });

  it("strips a trailing slash from the base URL", async () => {
    const { probe: p, fetchImpl } = probe(async () =>
      Response.json({ product: "bid", blockers: [] }),
    );
    await p.check("bid", SUBJECT);
    expect(String(fetchImpl.mock.calls[0]?.[0]).startsWith("https://bid.internal/internal/")).toBe(
      true,
    );
  });

  it.each([
    [
      "a product with no URL",
      { baseUrls: { bid: "https://bid.internal" } },
      "shop",
      "not_configured",
    ],
    ["missing credentials", { clientId: undefined }, "bid", "not_configured"],
  ] as const)(
    "cannot ask with %s, and does not call out",
    async (_label, overrides, product, code) => {
      const { probe: p, fetchImpl } = probe(async () => Response.json({}), overrides);
      expect((await rejection(p.check(product, SUBJECT)))?.code).toBe(code);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    [503, "unavailable"],
    [500, "unavailable"],
    [401, "rejected"],
    [404, "rejected"],
  ] as const)("rejects an HTTP %i as %s, never as clear", async (status, code) => {
    const { probe: p } = probe(async () => new Response("{}", { status }));
    const error = await rejection(p.check("bid", SUBJECT));
    expect(error).toBeInstanceOf(ProductDeletionEligibilityUnavailableError);
    expect(error?.code).toBe(code);
    expect(error?.product).toBe("bid");
  });

  it.each([
    ["not JSON", async () => new Response("<html>")],
    ["no blockers list", async () => Response.json({ product: "bid" })],
    [
      "a blocker with no message",
      async () => Response.json({ product: "bid", blockers: [{ code: "x", href: null }] }),
    ],
    ["another product's answer", async () => Response.json({ product: "shop", blockers: [] })],
  ])("rejects %s as an invalid answer", async (_label, respond) => {
    const { probe: p } = probe(respond);
    expect((await rejection(p.check("bid", SUBJECT)))?.code).toBe("invalid_response");
  });

  it("times out a slow product instead of waiting for it", async () => {
    const { probe: p } = probe(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    expect((await rejection(p.check("bid", SUBJECT)))?.code).toBe("timeout");
  });

  it("reports a network failure", async () => {
    const { probe: p } = probe(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect((await rejection(p.check("bid", SUBJECT)))?.code).toBe("network");
  });

  it("does not retry, so a person is never kept waiting twice", async () => {
    const { probe: p, fetchImpl } = probe(async () => new Response("{}", { status: 503 }));
    await rejection(p.check("bid", SUBJECT));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
