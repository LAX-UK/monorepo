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

  it("accepts dry_run without Zoho credentials, since it never calls Zoho", () => {
    stubEnv({ ZOHO_ARTWORK_WRITEBACK_MODE: "dry_run" });
    expect(loadWorkerEnv().ZOHO_ARTWORK_WRITEBACK_MODE).toBe("dry_run");
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
