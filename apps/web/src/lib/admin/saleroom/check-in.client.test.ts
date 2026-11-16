import { checkInBidder, searchCheckInCandidates } from "@/lib/admin/saleroom/check-in.client";
import { afterEach, describe, expect, it, vi } from "vitest";

const SALE = "11111111-1111-4111-8111-111111111111";
const ENTITY = "33333333-3333-4333-8333-333333333333";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(...responses: Response[]) {
  const fetch = vi.fn(async (_input: string, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("door check-in commands", () => {
  it("searches candidates through the BFF, never as a server action", async () => {
    const candidate = {
      userId: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      emailVerified: true,
      kycStatus: "verified",
      suspended: false,
      eligibleEntities: [],
    };
    const fetch = stubFetch(json(200, { data: { items: [candidate] } }));

    await expect(searchCheckInCandidates({ saleId: SALE, q: "jane d" })).resolves.toEqual({
      ok: true,
      data: { items: [candidate] },
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`/api/bff/admin/sales/${SALE}/registrations/check-in-candidates?q=jane+d`);
    // A plain GET: no `Next-Action` header, so not a server action.
    expect(init).toBeUndefined();
  });

  it("checks a bidder in with the sale in the path and the rest in the body", async () => {
    const fetch = stubFetch(
      json(201, {
        data: { registrationId: "reg-1", paddleNumber: 104, checkedInAt: "2026-11-16T10:00:00Z" },
      }),
    );

    await expect(
      checkInBidder({
        saleId: SALE,
        userId: "user-1",
        buyerLegalEntityId: ENTITY,
        assignPaddle: true,
        bidLimit: 5000,
        paddleNumber: 104,
      }),
    ).resolves.toEqual({
      ok: true,
      data: { registrationId: "reg-1", paddleNumber: 104, checkedInAt: "2026-11-16T10:00:00Z" },
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`/api/bff/admin/sales/${SALE}/registrations/check-in`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      userId: "user-1",
      buyerLegalEntityId: ENTITY,
      assignPaddle: true,
      bidLimit: 5000,
      paddleNumber: 104,
    });
  });

  it("returns the API's refusal code so the panel can explain it", async () => {
    stubFetch(json(409, { error: "Paddle taken", code: "paddle_taken" }));

    await expect(
      checkInBidder({ saleId: SALE, userId: "u", buyerLegalEntityId: ENTITY, assignPaddle: true }),
    ).resolves.toMatchObject({
      ok: false,
      error: "Paddle taken",
      errorCode: "paddle_taken",
    });
  });

  it("reports the caller's fallback, never success, when the request never lands", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(searchCheckInCandidates({ saleId: SALE, q: "jane" })).resolves.toMatchObject({
      ok: false,
      error: "Could not search clients",
    });
    await expect(
      checkInBidder({ saleId: SALE, userId: "u", buyerLegalEntityId: ENTITY, assignPaddle: true }),
    ).resolves.toMatchObject({ ok: false, error: "Check-in failed" });
  });

  it("reports the fallback when a refusal has no readable body", async () => {
    stubFetch(new Response("Bad gateway", { status: 502 }));

    await expect(
      checkInBidder({ saleId: SALE, userId: "u", buyerLegalEntityId: ENTITY, assignPaddle: true }),
    ).resolves.toMatchObject({ ok: false, error: "Check-in failed" });
  });
});
