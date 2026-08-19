import { describe, expect, it, vi } from "vitest";
import { wrapOAuthConsentUpsertAdapter } from "./oauth-consent-upsert.js";

describe("oauth consent upsert adapter", () => {
  it("updates existing consent and merges scopes instead of inserting a duplicate row", async () => {
    const create = vi.fn(async (args) => args.data);
    const update = vi.fn(async (args) => ({ ...args.update, id: "consent-1" }));
    const findOne = vi.fn(async () => ({
      clientId: "lax-shop-web",
      userId: "user-1",
      scopes: "openid profile email",
      consentGiven: true,
    }));
    const adapter = wrapOAuthConsentUpsertAdapter({
      create,
      findOne,
      update,
      transaction: async (callback) => callback({}),
    } as never);

    const row = await adapter.create({
      model: "oauthConsent",
      data: {
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid profile email offline_access",
        consentGiven: true,
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      model: "oauthConsent",
      where: [
        { field: "clientId", value: "lax-shop-web" },
        { field: "userId", value: "user-1" },
      ],
      update: expect.objectContaining({
        scopes: "openid profile email offline_access",
        consentGiven: true,
      }),
    });
    expect(row).toMatchObject({ scopes: "openid profile email offline_access" });
  });

  it("creates consent when no row exists yet", async () => {
    const create = vi.fn(async (args) => args.data);
    const findOne = vi.fn(async () => null);
    const adapter = wrapOAuthConsentUpsertAdapter({
      create,
      findOne,
      update: vi.fn(),
      transaction: async (callback) => callback({}),
    } as never);

    await adapter.create({
      model: "oauthConsent",
      data: {
        clientId: "lax-shop-web",
        userId: "user-1",
        scopes: "openid",
        consentGiven: true,
      },
    });

    expect(create).toHaveBeenCalledOnce();
  });
});
