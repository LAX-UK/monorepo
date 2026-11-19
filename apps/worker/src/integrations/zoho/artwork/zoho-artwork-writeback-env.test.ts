import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../../../env.js";

const CREDENTIALS = {
  ZOHO_CLIENT_ID: "client",
  ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
  ZOHO_REFRESH_TOKEN: "refresh", // gitleaks:allow
};

function stubEnv(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  // Outside production a live Zoho mode must be pinned to a sandbox CRM org.
  vi.stubEnv("ZOHO_CRM_EXPECTED_ORG_TYPE", "sandbox");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("ZOHO_ARTWORK_WRITEBACK_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_ARTWORK_WRITEBACK_MODE).toBe("off");
  });

  it("accepts dry_run once Zoho credentials are set", () => {
    stubEnv({ ...CREDENTIALS, ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run" });
    expect(loadWorkerEnv().ZOHO_ARTWORK_WRITEBACK_MODE).toBe("dry_run");
  });

  it("refuses dry_run without Zoho credentials, since the nightly Status pass reads Zoho", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
    expect(JSON.stringify(error.mock.calls)).toContain(
      "required when ZOHO_ARTWORK_WRITEBACK_MODE is not off",
    );
  });

  it("refuses dry_run with only part of the OAuth trio", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({
      ZOHO_CLIENT_ID: "client",
      ZOHO_CLIENT_SECRET: "secret", // gitleaks:allow
      ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run",
    });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("accepts live once Zoho credentials are set", () => {
    stubEnv({ ...CREDENTIALS, ZOHO_ARTWORK_WRITEBACK_MODE: "live" });
    expect(loadWorkerEnv().ZOHO_ARTWORK_WRITEBACK_MODE).toBe("live");
  });

  it("refuses live without Zoho credentials", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_ARTWORK_WRITEBACK_MODE: "live" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("refuses an unknown mode", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_ARTWORK_WRITEBACK_MODE: "canary" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });
});
