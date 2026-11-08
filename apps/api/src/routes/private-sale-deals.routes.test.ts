import { describe, expect, it, vi } from "vitest";
import type { ContainerPrivateSaleDealRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPrivateSaleDealRoutes } from "./private-sale-deals.js";

function setup(signedIn = true) {
  const parties = {
    list: vi.fn().mockResolvedValue([{ reference: "PS-0012" }]),
    detail: vi.fn().mockResolvedValue({ work: { title: "Harbour" } }),
    acceptTerms: vi.fn().mockResolvedValue({ ok: true, detail: { work: { title: "Harbour" } } }),
    pay: vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: "https://pay.example/c", amountMinor: 5 }),
  };
  const container = {
    finance: { privateSaleDealParties: parties },
    userSuspensionChecker: { isSuspended: async () => false },
  } as unknown as ContainerPrivateSaleDealRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: async () =>
      signedIn
        ? ({
            id: "u-1",
            role: "client",
            scopes: ["bid.read", "bid.write"],
            staffRoles: [],
          } as never)
        : null,
  };
  return { app: createPrivateSaleDealRoutes(container, authenticator), parties };
}

const post = { method: "POST" };

describe("private sale deal routes", () => {
  it("need a signed-in person for every route", async () => {
    const { app, parties } = setup(false);
    expect((await app.request("http://test/")).status).toBe(401);
    expect((await app.request("http://test/PS-0012")).status).toBe(401);
    expect((await app.request("http://test/PS-0012/accept-terms", post)).status).toBe(401);
    expect((await app.request("http://test/PS-0012/payment", post)).status).toBe(401);
    expect(parties.list).not.toHaveBeenCalled();
    expect(parties.pay).not.toHaveBeenCalled();
  });

  it("list and open a deal as the signed-in person only", async () => {
    const { app, parties } = setup();
    expect((await app.request("http://test/")).status).toBe(200);
    expect(parties.list).toHaveBeenCalledWith("u-1");
    expect((await app.request("http://test/ps-0012")).status).toBe(200);
    expect(parties.detail).toHaveBeenCalledWith("u-1", "PS-0012");
  });

  it("answers 404 for a deal the person is not in, the same as one that does not exist", async () => {
    const { app, parties } = setup();
    parties.detail.mockResolvedValueOnce(null);
    const res = await app.request("http://test/PS-0099");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "deal_not_found" });
  });

  it("rejects a reference that is not one", async () => {
    const { app, parties } = setup();
    expect((await app.request("http://test/not-a-deal")).status).toBe(400);
    expect(parties.detail).not.toHaveBeenCalled();
  });

  it("accepts the terms for the signed-in person", async () => {
    const { app, parties } = setup();
    const res = await app.request("http://test/PS-0012/accept-terms", post);
    expect(res.status).toBe(200);
    expect(parties.acceptTerms).toHaveBeenCalledWith("u-1", "PS-0012");
  });

  it.each([
    ["deal_not_found", 404],
    ["terms_not_configured", 409],
    ["not_open_for_terms", 409],
  ] as const)("answers %s with %i when accepting", async (error, status) => {
    const { app, parties } = setup();
    parties.acceptTerms.mockResolvedValueOnce({ ok: false, error });
    const res = await app.request("http://test/PS-0012/accept-terms", post);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("opens the checkout and returns where to pay", async () => {
    const { app, parties } = setup();
    const res = await app.request("http://test/PS-0012/payment", post);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { checkoutUrl: "https://pay.example/c", amountMinor: 5 },
    });
    expect(parties.pay).toHaveBeenCalledWith("u-1", "PS-0012");
  });

  it.each([
    ["deal_not_found", 404],
    ["compliance_hold", 409],
    ["already_paid", 409],
    ["not_payable_online", 409],
  ] as const)("answers %s with %i when paying", async (error, status) => {
    const { app, parties } = setup();
    parties.pay.mockResolvedValueOnce({ ok: false, error });
    const res = await app.request("http://test/PS-0012/payment", post);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });
});
