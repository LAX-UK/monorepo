import { afterEach, describe, expect, it, vi } from "vitest";
import { createIssuerSecurityFactsReader } from "./issuer-security-facts-reader";

const config = {
  oidcInternalIssuer: "https://auth.internal",
  oidcClientId: "lax-account-web",
  oidcClientSecret: "client-secret",
};

function reader(response: () => Promise<Response>) {
  const fetchImpl = vi.fn(response);
  return { fetchImpl, reader: createIssuerSecurityFactsReader(config, fetchImpl as never) };
}

afterEach(() => vi.restoreAllMocks());

describe("createIssuerSecurityFactsReader", () => {
  it("posts the access token in the body with the client's Basic credentials", async () => {
    const { fetchImpl, reader: r } = reader(async () =>
      Response.json({ twoFactorEnabled: true, backupCodesRemaining: 2 }),
    );
    expect(await r.read("access-token")).toEqual({
      twoFactorEnabled: true,
      backupCodesRemaining: 2,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://auth.internal/api/auth/lax/account-security-facts");
    expect(url).not.toContain("access-token");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("lax-account-web:client-secret").toString("base64")}`,
    );
    expect(String(init.body)).toBe("token=access-token");
  });

  it("returns null for a refusal, a bad body or a network failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      await reader(async () => new Response("{}", { status: 401 })).reader.read("t"),
    ).toBeNull();
    expect(
      await reader(async () => new Response("{}", { status: 503 })).reader.read("t"),
    ).toBeNull();
    expect(
      await reader(async () => Response.json({ twoFactorEnabled: "yes" })).reader.read("t"),
    ).toBeNull();
    expect(
      await reader(async () => {
        throw new Error("timeout");
      }).reader.read("t"),
    ).toBeNull();
  });
});
