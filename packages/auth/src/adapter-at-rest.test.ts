import { describe, expect, it, vi } from "vitest";
import { wrapAuthDatabaseAdapter } from "./adapter-at-rest.js";
import { createEnvelopeCrypto } from "./crypto/envelope.js";

describe("auth adapter at-rest protection", () => {
  it("stores OIDC bearer tokens as fingerprints and translates token lookups", async () => {
    const create = vi.fn(async (args) => args.data);
    const findOne = vi.fn(async () => null);
    const deleteRow = vi.fn(async () => undefined);
    const base = {
      create,
      findOne,
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => null),
      updateMany: vi.fn(async () => 0),
      delete: deleteRow,
      deleteMany: vi.fn(async () => 0),
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    };
    const adapter = wrapAuthDatabaseAdapter(
      base as never,
      createEnvelopeCrypto(Buffer.alloc(32, 7)),
    );

    const created = await adapter.create({
      model: "oauthAccessToken",
      data: { accessToken: "access-raw", refreshToken: "refresh-raw" },
    });
    expect(create.mock.calls[0]?.[0].data.accessToken).toMatch(/^h1:/);
    expect(create.mock.calls[0]?.[0].data.refreshToken).toMatch(/^h1:/);
    expect(created).toMatchObject({
      accessToken: "access-raw",
      refreshToken: "refresh-raw",
    });

    await adapter.findOne({
      model: "oauthAccessToken",
      where: [{ field: "refreshToken", value: "refresh-raw" }],
    });
    expect(findOne.mock.calls[0]?.[0].where[0].value).toMatch(/^h1:/);

    await adapter.delete({
      model: "oauthAccessToken",
      where: [{ field: "accessToken", value: "access-raw" }],
    });
    expect(deleteRow.mock.calls[0]?.[0].where[0].value).toMatch(/^h1:/);

    await adapter.create({
      model: "account",
      data: { accessToken: "", refreshToken: null, idToken: null },
    });
    expect(create.mock.calls[1]?.[0].data.accessToken).toMatch(/^v1:/);
  });
});

describe("the address a provider reported", () => {
  function setup() {
    const stored: Record<string, unknown>[] = [];
    const base = {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        stored.push(args.data);
        return args.data;
      }),
      findOne: vi.fn(async () => stored[0] ?? null),
      findMany: vi.fn(async () => stored),
      update: vi.fn(async (args: { update: Record<string, unknown> }) => args.update),
      updateMany: vi.fn(async () => 0),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => 0),
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    };
    const adapter = wrapAuthDatabaseAdapter(
      base as never,
      createEnvelopeCrypto(Buffer.alloc(32, 9)),
    );
    return { adapter, stored, base };
  }

  it("is sealed when the account row is written, and read back as written", async () => {
    const { adapter, stored } = setup();
    const created = await adapter.create({
      model: "account",
      data: { providerId: "google", providerEmail: "ada@example.com" },
    });
    expect(stored[0]?.providerEmail).toMatch(/^v1:/);
    expect(JSON.stringify(stored)).not.toContain("ada@example.com");
    expect(created).toMatchObject({ providerEmail: "ada@example.com" });
    expect(await adapter.findOne({ model: "account", where: [] })).toMatchObject({
      providerEmail: "ada@example.com",
    });
  });

  it("is sealed when it is changed, and left alone on other models", async () => {
    const { adapter, base } = setup();
    await adapter.update({
      model: "account",
      where: [],
      update: { providerEmail: "relay@privaterelay.appleid.com" },
    });
    expect(base.update.mock.calls[0]?.[0].update.providerEmail).toMatch(/^v1:/);
    await adapter.create({ model: "user", data: { providerEmail: "plain" } });
    expect(base.create.mock.calls.at(-1)?.[0].data.providerEmail).toBe("plain");
  });
});
