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
  });
});
