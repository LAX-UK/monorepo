import { describe, expect, it } from "vitest";
import { ZohoBooksConfigError, parseZohoBooksConfig } from "./config.js";
import { Secret } from "./secret.js";
import { ZohoBooksTokenSealer, ZohoBooksTokenSealingError } from "./token-sealer.js";

const base = {
  ZOHO_BOOKS_CLIENT_ID: "id",
  ZOHO_BOOKS_CLIENT_SECRET: "secret",
  ZOHO_BOOKS_TOKEN_DEK_KEY: "ab".repeat(32),
};

describe("parseZohoBooksConfig", () => {
  it("defaults to the EU data centre", () => {
    const config = parseZohoBooksConfig(base);
    expect(config.apiBaseUrl).toBe("https://books.zoho.eu/api/v3");
    expect(config.accountsBaseUrl).toBe("https://accounts.zoho.eu");
    expect(config.ratePerMinute).toBe(100);
    expect(config.maxConcurrent).toBe(5);
  });

  it("fails closed without client id, secret or token key", () => {
    for (const key of Object.keys(base)) {
      expect(() => parseZohoBooksConfig({ ...base, [key]: " " })).toThrow(ZohoBooksConfigError);
      const { [key as keyof typeof base]: _omit, ...rest } = base;
      expect(() => parseZohoBooksConfig(rest)).toThrow(ZohoBooksConfigError);
    }
  });

  it.each([
    "http://books.zoho.eu/api/v3",
    "https://books.zoho.com/api/v3",
    "https://books.zoho.eu.evil.example/api/v3",
    "https://evil.example/books.zoho.eu",
    "https://user:pw@books.zoho.eu/api/v3",
    "https://books.zoho.eu:8443/api/v3",
    "https://books.zoho.eu/api/v3?x=1",
    "not a url",
  ])("refuses the API base %s", (url) => {
    expect(() => parseZohoBooksConfig({ ...base, ZOHO_BOOKS_API_BASE_URL: url })).toThrow(
      ZohoBooksConfigError,
    );
  });

  it("refuses an accounts host outside the EU data centre", () => {
    expect(() =>
      parseZohoBooksConfig({ ...base, ZOHO_BOOKS_ACCOUNTS_BASE_URL: "https://accounts.zoho.com" }),
    ).toThrow(ZohoBooksConfigError);
  });

  it("cannot be raised above Zoho's own limits", () => {
    expect(() => parseZohoBooksConfig({ ...base, ZOHO_BOOKS_RATE_PER_MINUTE: "101" })).toThrow();
    expect(() => parseZohoBooksConfig({ ...base, ZOHO_BOOKS_MAX_CONCURRENT: "6" })).toThrow();
    expect(() => parseZohoBooksConfig({ ...base, ZOHO_BOOKS_DAILY_CALL_BUDGET: "0" })).toThrow();
  });

  it("does not print secrets", () => {
    const config = parseZohoBooksConfig(base);
    expect(JSON.stringify(config)).not.toContain("secret");
    expect(JSON.stringify(config)).not.toContain("abab");
    expect(String(config.clientSecret)).toBe("[redacted]");
  });
});

describe("ZohoBooksTokenSealer", () => {
  const key = "cd".repeat(32);

  it("fails closed without a key and rejects a malformed one without echoing it", () => {
    for (const missing of [undefined, null, "", "  "]) {
      expect(() => ZohoBooksTokenSealer.fromKey(missing)).toThrow(
        expect.objectContaining({ code: "key_missing" }),
      );
    }
    let thrown: unknown;
    try {
      ZohoBooksTokenSealer.fromKey("short-secret-key");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ZohoBooksTokenSealingError);
    expect(String((thrown as Error).message)).not.toContain("short-secret-key");
  });

  it("round-trips through the shared v1 envelope and stores no plaintext", () => {
    const sealer = ZohoBooksTokenSealer.fromKey(new Secret(key));
    const sealed = sealer.seal("refresh-token-value");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("refresh-token-value");
    expect(sealer.open(sealed)).toBe("refresh-token-value");
    expect(sealer.seal("x")).not.toBe(sealer.seal("x"));
  });

  it("refuses plaintext, a tampered envelope and a different key", () => {
    const sealer = ZohoBooksTokenSealer.fromKey(key);
    expect(() => sealer.open("plain-token")).toThrow(
      expect.objectContaining({ code: "unreadable" }),
    );
    const sealed = sealer.seal("t");
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("A") ? "B" : "A"}A`;
    expect(() => sealer.open(tampered)).toThrow(expect.objectContaining({ code: "unreadable" }));
    const other = ZohoBooksTokenSealer.fromKey("ef".repeat(32));
    expect(() => other.open(sealed)).toThrow(expect.objectContaining({ code: "unreadable" }));
  });
});
