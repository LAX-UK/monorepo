import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { mountInternalAddressRoutes } from "./internal-addresses.routes.js";

const SUBJECT = "bid-user-1";
const ADDRESS_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const ADDRESS = {
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
};
const row = {
  ...ADDRESS,
  id: ADDRESS_ID,
  subjectId: SUBJECT,
  line2: null,
  region: null,
  phone: null,
  isDefaultShipping: true,
  isDefaultBilling: false,
  version: 3,
  createdAt: NOW,
  updatedAt: NOW,
};

function setup() {
  const addresses = {
    list: vi.fn().mockResolvedValue([row]),
    create: vi.fn().mockResolvedValue({ ok: true, address: row }),
    update: vi.fn().mockResolvedValue({ ok: true, address: row }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
    setDefault: vi.fn().mockResolvedValue({ ok: true, address: row }),
  };
  const app = new Hono();
  mountInternalAddressRoutes(app, { addresses });
  const send = (method: string, path: string, body?: unknown) =>
    app.request(`/identity/subjects/${SUBJECT}/addresses${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { addresses, send };
}

describe("internal address routes", () => {
  it("lists the subject's addresses without the subject id", async () => {
    const { send, addresses } = setup();
    const response = await send("GET", "");
    expect(addresses.list).toHaveBeenCalledWith(SUBJECT);
    const body = (await response.json()) as { addresses: Record<string, unknown>[] };
    expect(body.addresses[0]).toMatchObject({ id: ADDRESS_ID, version: 3 });
    expect(body.addresses[0]).not.toHaveProperty("subjectId");
  });

  it("creates, updates, deletes and sets a default for the named subject", async () => {
    const { send, addresses } = setup();
    expect((await send("POST", "", { address: ADDRESS })).status).toBe(200);
    expect(addresses.create).toHaveBeenCalledWith(
      SUBJECT,
      expect.objectContaining({ country: "GB" }),
    );

    expect(
      (await send("PATCH", `/${ADDRESS_ID}`, { address: ADDRESS, expectedVersion: 3 })).status,
    ).toBe(200);
    expect(addresses.update).toHaveBeenCalledWith(SUBJECT, ADDRESS_ID, 3, expect.any(Object));

    expect((await send("DELETE", `/${ADDRESS_ID}?expectedVersion=3`)).status).toBe(200);
    expect(addresses.delete).toHaveBeenCalledWith(SUBJECT, ADDRESS_ID, 3);

    expect((await send("POST", `/${ADDRESS_ID}/default`, { kind: "billing" })).status).toBe(200);
    expect(addresses.setDefault).toHaveBeenCalledWith(SUBJECT, ADDRESS_ID, "billing");
  });

  it("rejects invalid input before touching the store", async () => {
    const { send, addresses } = setup();
    expect((await send("POST", "", { address: { label: "x" } })).status).toBe(400);
    expect((await send("PATCH", `/${ADDRESS_ID}`, { address: ADDRESS })).status).toBe(400);
    expect((await send("DELETE", "/not-a-uuid?expectedVersion=1")).status).toBe(400);
    expect((await send("POST", `/${ADDRESS_ID}/default`, { kind: "both" })).status).toBe(400);
    expect(Object.values(addresses).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it("maps refusals to 404 and 409", async () => {
    const { send, addresses } = setup();
    addresses.update.mockResolvedValueOnce({ ok: false, reason: "version_conflict" });
    addresses.delete.mockResolvedValueOnce({ ok: false, reason: "address_not_found" });
    addresses.create.mockResolvedValueOnce({ ok: false, reason: "address_limit_reached" });
    expect(
      (await send("PATCH", `/${ADDRESS_ID}`, { address: ADDRESS, expectedVersion: 1 })).status,
    ).toBe(409);
    expect((await send("DELETE", `/${ADDRESS_ID}?expectedVersion=1`)).status).toBe(404);
    expect((await send("POST", "", { address: ADDRESS })).status).toBe(409);
  });
});
