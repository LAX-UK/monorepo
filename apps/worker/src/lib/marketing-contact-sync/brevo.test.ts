import { describe, expect, it, vi } from "vitest";
import { BrevoContactSync } from "./brevo.js";
import type { MarketingContact } from "./types.js";

const contact: MarketingContact = {
  userId: "user-1",
  email: "buyer@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  country: "GB",
  kycStatus: "approved",
  emailVerified: true,
  signupSource: "individual",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function adapter(fetchImpl: typeof fetch) {
  return new BrevoContactSync({ apiKey: "key-123", listId: 7, fetchImpl });
}

describe("BrevoContactSync.upsertContact", () => {
  it("POSTs an upsert with attributes, listIds and updateEnabled, returning the contact id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 42 }));
    const result = await adapter(fetchImpl as unknown as typeof fetch).upsertContact(contact);

    expect(result).toEqual({ ok: true, action: "upsert", providerContactId: "42" });
    const call = fetchImpl.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    const [url, init] = call;
    expect(url).toBe("https://api.brevo.com/v3/contacts");
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("key-123");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      email: "buyer@example.com",
      listIds: [7],
      updateEnabled: true,
      attributes: {
        FIRSTNAME: "Ada",
        LASTNAME: "Lovelace",
        COUNTRY: "GB",
        KYC_STATUS: "approved",
        EMAIL_VERIFIED: true,
        SIGNUP_SOURCE: "individual",
      },
    });
  });

  it("treats 4xx (except 429) as a terminal, non-retryable rejection", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { code: "invalid_parameter" }));
    const result = await adapter(fetchImpl as unknown as typeof fetch).upsertContact(contact);
    expect(result).toEqual(expect.objectContaining({ ok: false, retryable: false, code: 400 }));
  });

  it("treats 429 as retryable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, { code: "too_many_requests" }));
    const result = await adapter(fetchImpl as unknown as typeof fetch).upsertContact(contact);
    expect(result).toEqual(expect.objectContaining({ ok: false, retryable: true, code: 429 }));
  });

  it("treats 5xx as retryable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    const result = await adapter(fetchImpl as unknown as typeof fetch).upsertContact(contact);
    expect(result).toEqual(expect.objectContaining({ ok: false, retryable: true, code: 503 }));
  });

  it("treats a network error as retryable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const result = await adapter(fetchImpl as unknown as typeof fetch).upsertContact(contact);
    expect(result).toEqual(expect.objectContaining({ ok: false, retryable: true }));
  });
});

describe("BrevoContactSync.archiveContact", () => {
  it("DELETEs the contact by email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await adapter(fetchImpl as unknown as typeof fetch).archiveContact(
      "buyer@example.com",
    );
    expect(result).toEqual({ ok: true, action: "archive", providerContactId: undefined });
    const call = fetchImpl.mock.calls[0] as [string, { method: string }];
    const [url, init] = call;
    expect(url).toBe("https://api.brevo.com/v3/contacts/buyer%40example.com");
    expect(init.method).toBe("DELETE");
  });

  it("treats a 404 on archive as success (already gone)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, { code: "document_not_found" }));
    const result = await adapter(fetchImpl as unknown as typeof fetch).archiveContact(
      "missing@example.com",
    );
    expect(result).toEqual({ ok: true, action: "archive" });
  });
});

describe("BrevoContactSync.enabled", () => {
  it("is false without an api key or a valid list id", () => {
    expect(new BrevoContactSync({ apiKey: "", listId: 7 }).enabled()).toBe(false);
    expect(new BrevoContactSync({ apiKey: "k", listId: 0 }).enabled()).toBe(false);
    expect(new BrevoContactSync({ apiKey: "k", listId: 7 }).enabled()).toBe(true);
  });
});
