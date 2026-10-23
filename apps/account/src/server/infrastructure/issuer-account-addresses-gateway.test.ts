import { afterEach, describe, expect, it, vi } from "vitest";
import { createIssuerAccountIdentityGateway } from "./issuer-account-identity-gateway";

const config = {
  oidcInternalIssuer: "https://auth.internal",
  oidcClientId: "lax-account-web",
  oidcClientSecret: "client-secret",
};
const actor = { accessToken: "access-token", sid: "current-sid" };
const ADDRESS_ID = "33333333-3333-4333-8333-333333333333";
const WIRE = {
  id: ADDRESS_ID,
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: null,
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
  isDefaultShipping: true,
  isDefaultBilling: true,
  version: 2,
  createdAt: "2026-10-23T12:00:00.000Z",
  updatedAt: "2026-10-23T12:00:00.000Z",
};
const INPUT = {
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: null,
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
};

function gateway(response: () => Promise<Response>) {
  const fetchImpl = vi.fn(response);
  return { fetchImpl, gateway: createIssuerAccountIdentityGateway(config, fetchImpl as never) };
}

function lastRequest(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, body: new URLSearchParams(String(init.body)) };
}

afterEach(() => vi.restoreAllMocks());

describe("address calls", () => {
  it("lists with the token only", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ addresses: [WIRE] }));
    expect(await g.listAddresses(actor)).toEqual({ status: "ok", value: [WIRE] });
    const { url, body } = lastRequest(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/account-addresses");
    expect(Object.fromEntries(body)).toEqual({ token: "access-token" });
  });

  it("creates with the sign-in and the address as one JSON field", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ address: WIRE }));
    expect(await g.createAddress(actor, INPUT)).toEqual({ status: "ok", value: WIRE });
    const { url, body } = lastRequest(fetchImpl);
    expect(url).toBe("https://auth.internal/api/auth/lax/account-addresses/create");
    expect(body.get("sid")).toBe("current-sid");
    expect(JSON.parse(body.get("address") ?? "")).toEqual(INPUT);
  });

  it("updates and deletes with the version the person saw", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ address: WIRE }));
    await g.updateAddress(actor, ADDRESS_ID, 2, INPUT);
    expect(lastRequest(fetchImpl).body.get("expected_version")).toBe("2");
    expect(lastRequest(fetchImpl).body.get("address_id")).toBe(ADDRESS_ID);

    const deleted = gateway(async () => Response.json({ deleted: true }));
    expect(await deleted.gateway.deleteAddress(actor, ADDRESS_ID, 2)).toEqual({
      status: "ok",
      value: true,
    });
    expect(lastRequest(deleted.fetchImpl).url).toMatch(/account-addresses\/delete$/);
  });

  it("makes a default without sending a sign-in", async () => {
    const { fetchImpl, gateway: g } = gateway(async () => Response.json({ address: WIRE }));
    await g.setDefaultAddress(actor, ADDRESS_ID, "billing");
    expect(Object.fromEntries(lastRequest(fetchImpl).body)).toEqual({
      token: "access-token",
      address_id: ADDRESS_ID,
      kind: "billing",
    });
  });

  it.each(["version_conflict", "address_limit_reached", "address_not_found"])(
    "reports the issuer's %s refusal so the person can act on it",
    async (error) => {
      const { gateway: g } = gateway(async () => Response.json({ error }, { status: 409 }));
      expect(await g.deleteAddress(actor, ADDRESS_ID, 1)).toEqual({
        status: "rejected",
        reason: error,
      });
    },
  );

  it("turns reauth_required into a fresh sign-in and anything else into unavailable", async () => {
    const reauth = gateway(async () =>
      Response.json({ error: "reauth_required" }, { status: 403 }),
    );
    expect(await reauth.gateway.createAddress(actor, INPUT)).toEqual({ status: "reauth_required" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const broken = gateway(async () => Response.json({ nope: true }));
    expect(await broken.gateway.listAddresses(actor)).toEqual({ status: "unavailable" });
  });
});
