import { describe, expect, it, vi } from "vitest";
import { wrapOAuthConsentUpsertAdapter } from "./oauth-consent-upsert.js";
import type { ConsentStore } from "./ports/consent-store.js";

describe("oauth consent upsert adapter", () => {
  it("routes oauthConsent creates through ConsentStore.upsert", async () => {
    const upsert = vi.fn(async (input) => input);
    const consentStore: ConsentStore = { upsert };
    const create = vi.fn();
    const adapter = wrapOAuthConsentUpsertAdapter(
      {
        create,
        transaction: async (callback) => callback({}),
      } as never,
      consentStore,
    );

    const now = new Date();
    await adapter.create({
      model: "oauthConsent",
      data: {
        id: "consent-1",
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid profile email offline_access",
        consentGiven: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith({
      id: "consent-1",
      clientId: "lax-shop-web",
      userId: "user-1",
      scopes: "openid profile email offline_access",
      consentGiven: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("accepts ISO date strings from the Better Auth drizzle adapter", async () => {
    const upsert = vi.fn(async (input) => input);
    const create = vi.fn();
    const adapter = wrapOAuthConsentUpsertAdapter(
      {
        create,
        transaction: async (callback) => callback({}),
      } as never,
      { upsert },
    );

    await adapter.create({
      model: "oauthConsent",
      data: {
        id: "consent-2",
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid profile email offline_access",
        consentGiven: true,
        createdAt: "2026-08-19T00:00:00.000Z",
        updatedAt: "2026-08-19T00:00:00.000Z",
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("accepts snake_case fields and numeric consent flags", async () => {
    const upsert = vi.fn(async (input) => input);
    const create = vi.fn();
    const adapter = wrapOAuthConsentUpsertAdapter(
      {
        create,
        transaction: async (callback) => callback({}),
      } as never,
      { upsert },
    );

    await adapter.create({
      model: "oauthConsent",
      data: {
        id: "consent-3",
        client_id: "lax-shop-web",
        user_id: "user-1",
        scopes: ["openid", "offline_access"],
        consent_given: 1,
        created_at: "2026-08-19T00:00:00.000Z",
        updated_at: "2026-08-19T00:00:00.000Z",
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid offline_access",
        consentGiven: true,
      }),
    );
  });

  it("generates an id when Better Auth omits one on consent create", async () => {
    const upsert = vi.fn(async (input) => input);
    const create = vi.fn();
    const adapter = wrapOAuthConsentUpsertAdapter(
      {
        create,
        transaction: async (callback) => callback({}),
      } as never,
      { upsert },
    );

    const now = new Date();
    await adapter.create({
      model: "oauthConsent",
      data: {
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid profile email offline_access",
        consentGiven: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      clientId: "lax-shop-web",
      userId: "user-1",
      scopes: "openid profile email offline_access",
      consentGiven: true,
    });
  });

  it("delegates non-consent models to the base adapter", async () => {
    const create = vi.fn(async (args) => args.data);
    const upsert = vi.fn();
    const adapter = wrapOAuthConsentUpsertAdapter(
      {
        create,
        transaction: async (callback) => callback({}),
      } as never,
      { upsert },
    );

    await adapter.create({
      model: "session",
      data: { id: "session-1" },
    });

    expect(create).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
  });
});
