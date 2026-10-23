import { describe, expect, it, vi } from "vitest";
import { createAccountAddressRoutes } from "./account-addresses.routes.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const ADDRESS_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-23T12:00:00.000Z");

const ADDRESS = JSON.stringify({
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  city: "London",
  postcode: "sw1a 1aa",
  country: "GB",
});

const row = {
  id: ADDRESS_ID,
  subjectId: SUBJECT,
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
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    writeRateLimit?: number | null;
    recent?: boolean;
  } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const addresses = {
    list: vi.fn().mockResolvedValue([row]),
    create: vi.fn().mockResolvedValue({ ok: true, address: row }),
    update: vi.fn().mockResolvedValue({ ok: true, address: { ...row, version: 2 } }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
    setDefault: vi.fn().mockResolvedValue({ ok: true, address: row }),
  };
  const findRecent = vi.fn().mockResolvedValue(overrides.recent === false ? null : { id: "sid" });
  const onFailure = vi.fn();
  const app = createAccountAddressRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    addresses,
    sessions: { findRecent },
    readRateLimit: async () => null,
    writeRateLimit: async () => overrides.writeRateLimit ?? null,
    onFailure,
  });
  const call = (path: string, fields: Record<string, string>, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  return { call, addresses, findRecent, introspect, onFailure };
}

const CHANGES: [string, Record<string, string>][] = [
  ["/lax/account-addresses/create", { token: "t", sid: "sid", address: ADDRESS }],
  [
    "/lax/account-addresses/update",
    { token: "t", sid: "sid", address: ADDRESS, address_id: ADDRESS_ID, expected_version: "1" },
  ],
  [
    "/lax/account-addresses/delete",
    { token: "t", sid: "sid", address_id: ADDRESS_ID, expected_version: "1" },
  ],
  ["/lax/account-addresses/default", { token: "t", address_id: ADDRESS_ID, kind: "billing" }],
];
const ALL: [string, Record<string, string>][] = [
  ["/lax/account-addresses", { token: "t" }],
  ...CHANGES,
];

describe("account address routes", () => {
  it.each(ALL)("%s refuses every client except LAX Account", async (path, fields) => {
    const { call, introspect } = setup({ client: "lax-bid-web" });
    expect((await call(path, fields, basic("lax-bid-web"))).status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(ALL)("%s refuses bad client credentials and inactive tokens", async (path, fields) => {
    expect((await setup({ client: null }).call(path, fields)).status).toBe(401);
    const { call, addresses } = setup({ introspection: { active: false } });
    expect((await call(path, fields)).status).toBe(401);
    expect(Object.values(addresses).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it.each(CHANGES)("%s answers 429 when the person is over their budget", async (path, fields) => {
    expect((await setup({ writeRateLimit: 9 }).call(path, fields)).status).toBe(429);
  });

  it("lists the addresses of the token's owner only, whatever the body names", async () => {
    const { call, addresses } = setup();
    const response = await call("/lax/account-addresses", {
      token: "t",
      sub: OTHER_SUBJECT,
      subject_id: OTHER_SUBJECT,
    });
    expect(response.status).toBe(200);
    expect(addresses.list).toHaveBeenCalledWith(SUBJECT);
    const body = (await response.json()) as { addresses: Record<string, unknown>[] };
    expect(body.addresses[0]).not.toHaveProperty("subjectId");
    expect(body.addresses[0]).toMatchObject({ id: ADDRESS_ID, version: 1, postcode: "SW1A 1AA" });
  });

  it("creates with the normalised address for the token's owner", async () => {
    const { call, addresses } = setup();
    const response = await call("/lax/account-addresses/create", {
      token: "t",
      sid: "sid",
      address: ADDRESS,
      subject_id: OTHER_SUBJECT,
    });
    expect(response.status).toBe(200);
    expect(addresses.create).toHaveBeenCalledWith(
      SUBJECT,
      expect.objectContaining({ postcode: "SW1A 1AA", line2: null, phone: null }),
    );
  });

  it.each(CHANGES.slice(0, 3))(
    "%s needs a recent sign-in and answers reauth_required",
    async (path, fields) => {
      const { call, addresses } = setup({ recent: false });
      const response = await call(path, fields);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "reauth_required" });
      expect(addresses.create.mock.calls.length + addresses.update.mock.calls.length).toBe(0);
      expect(addresses.delete).not.toHaveBeenCalled();
    },
  );

  it("refuses a change that carries no sign-in at all", async () => {
    const { call } = setup({ recent: false });
    const response = await call("/lax/account-addresses/delete", {
      token: "t",
      address_id: ADDRESS_ID,
      expected_version: "1",
    });
    expect(response.status).toBe(403);
  });

  it("making an address the default does not need a recent sign-in", async () => {
    const { call, addresses } = setup({ recent: false });
    const response = await call("/lax/account-addresses/default", {
      token: "t",
      address_id: ADDRESS_ID,
      kind: "billing",
    });
    expect(response.status).toBe(200);
    expect(addresses.setDefault).toHaveBeenCalledWith(SUBJECT, ADDRESS_ID, "billing");
  });

  it.each([
    ["an invalid address", { address: JSON.stringify({ label: "x" }) }],
    ["an address that is not JSON", { address: "{nope" }],
    ["a missing address", {}],
  ])("rejects %s", async (_label, extra) => {
    const { call, addresses } = setup();
    const response = await call("/lax/account-addresses/create", {
      token: "t",
      sid: "sid",
      ...extra,
    });
    expect(response.status).toBe(400);
    expect(addresses.create).not.toHaveBeenCalled();
  });

  it.each([
    ["no version", { address_id: ADDRESS_ID }],
    ["a zero version", { address_id: ADDRESS_ID, expected_version: "0" }],
    ["a malformed id", { address_id: "not-a-uuid", expected_version: "1" }],
  ])("rejects a delete with %s", async (_label, extra) => {
    const { call, addresses } = setup();
    const response = await call("/lax/account-addresses/delete", {
      token: "t",
      sid: "sid",
      ...extra,
    });
    expect(response.status).toBe(400);
    expect(addresses.delete).not.toHaveBeenCalled();
  });

  it("passes the expected version through and reports a version conflict as 409", async () => {
    const { call, addresses } = setup();
    addresses.update.mockResolvedValueOnce({ ok: false, reason: "version_conflict" });
    const response = await call("/lax/account-addresses/update", {
      token: "t",
      sid: "sid",
      address: ADDRESS,
      address_id: ADDRESS_ID,
      expected_version: "4",
    });
    expect(addresses.update).toHaveBeenCalledWith(SUBJECT, ADDRESS_ID, 4, expect.any(Object));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
  });

  it("reports another person's address as not found", async () => {
    const { call, addresses } = setup();
    addresses.delete.mockResolvedValueOnce({ ok: false, reason: "address_not_found" });
    const response = await call("/lax/account-addresses/delete", {
      token: "t",
      sid: "sid",
      address_id: ADDRESS_ID,
      expected_version: "1",
    });
    expect(response.status).toBe(404);
  });

  it("reports the address limit as 409", async () => {
    const { call, addresses } = setup();
    addresses.create.mockResolvedValueOnce({ ok: false, reason: "address_limit_reached" });
    const response = await call("/lax/account-addresses/create", {
      token: "t",
      sid: "sid",
      address: ADDRESS,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "address_limit_reached" });
  });

  it("answers a generic 503 when the store fails", async () => {
    const { call, addresses, onFailure } = setup();
    addresses.list.mockRejectedValueOnce(new Error("connection refused: postgres://secret"));
    const response = await call("/lax/account-addresses", { token: "t" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
    expect(onFailure).toHaveBeenCalled();
  });
});
