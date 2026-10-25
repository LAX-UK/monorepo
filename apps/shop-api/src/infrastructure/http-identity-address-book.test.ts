import { describe, expect, it, vi } from "vitest";
import { createHttpIdentityAddressBook } from "./http-identity-address-book.js";

const accountAddress = {
  id: "550e8400-e29b-41d4-a716-846655440002",
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
  version: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(responses: Response[]) {
  const fetchImpl = vi.fn(
    async (_url: string, _init?: RequestInit) => responses.shift() ?? json({}, 500),
  );
  const book = createHttpIdentityAddressBook({
    issuerBaseUrl: "http://identity.test/",
    clientId: "machine",
    clientSecret: "machine-secret-at-least-32-characters-long",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { book, fetchImpl };
}

const token = () => json({ access_token: "t1", expires_in: 300 });

describe("createHttpIdentityAddressBook", () => {
  it("lists the subject's addresses with a machine token, passing on delivery fields only", async () => {
    const { book, fetchImpl } = setup([token(), json({ addresses: [accountAddress] })]);
    const addresses = await book.list("subject 1");
    expect(addresses).toEqual([
      {
        id: accountAddress.id,
        label: "Home",
        recipientName: "Ada Lovelace",
        line1: "1 High Street",
        line2: null,
        city: "London",
        postcode: "SW1A 1AA",
        country: "GB",
        phone: null,
        isDefaultShipping: true,
      },
    ]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://identity.test/internal/oauth/token");
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("http://identity.test/internal/identity/subjects/subject%201/addresses");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t1");
  });

  it("reuses the token, and fetches a new one once after a 401", async () => {
    const { book, fetchImpl } = setup([
      token(),
      json({ addresses: [] }),
      json({ error: "unauthorized" }, 401),
      json({ access_token: "t2", expires_in: 300 }),
      json({ addresses: [] }),
    ]);
    await book.list("s");
    await book.list("s");
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const last = fetchImpl.mock.calls[4] as unknown as [string, RequestInit];
    expect((last[1].headers as Record<string, string>).authorization).toBe("Bearer t2");
  });

  it("adds an address in the book's shape", async () => {
    const { book, fetchImpl } = setup([token(), json({ address: accountAddress })]);
    await book.add("s", {
      label: "1 High Street",
      recipientName: "Ada Lovelace",
      line1: "1 High Street",
      line2: null,
      city: "London",
      postcode: "SW1A 1AA",
      country: "GB",
      phone: null,
    });
    const [, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      address: expect.objectContaining({ recipientName: "Ada Lovelace", region: null }),
    });
  });

  it("rejects when the book refuses", async () => {
    const { book } = setup([token(), json({ error: "address_limit_reached" }, 409)]);
    await expect(
      book.add("s", {
        label: "x",
        recipientName: "x",
        line1: "x",
        line2: null,
        city: "x",
        postcode: "SW1A 1AA",
        country: "GB",
        phone: null,
      }),
    ).rejects.toThrow("409");
  });
});
