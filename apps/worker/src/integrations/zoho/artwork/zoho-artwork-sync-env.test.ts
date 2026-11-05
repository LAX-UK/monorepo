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

describe("ZOHO_ARTWORK_SYNC_MODE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless it is set", () => {
    stubEnv({});
    expect(loadWorkerEnv().ZOHO_ARTWORK_SYNC_MODE).toBe("off");
  });

  it("accepts dry_run and live once Zoho credentials and notice processing are set", () => {
    for (const mode of ["dry_run", "live"]) {
      stubEnv({ ...CREDENTIALS, WEBHOOK_EVENTS_PROCESS: "true", ZOHO_ARTWORK_SYNC_MODE: mode });
      expect(loadWorkerEnv().ZOHO_ARTWORK_SYNC_MODE).toBe(mode);
    }
  });

  it("refuses an unknown mode", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ZOHO_ARTWORK_SYNC_MODE: "canary" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("refuses to run without Zoho credentials", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ WEBHOOK_EVENTS_PROCESS: "true", ZOHO_ARTWORK_SYNC_MODE: "dry_run" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("refuses to run when stored notices would never be processed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubEnv({ ...CREDENTIALS, ZOHO_ARTWORK_SYNC_MODE: "dry_run", WEBHOOK_EVENTS_PROCESS: "false" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
  });

  it("refuses live in production unless pictures go to S3 storage", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const live = { ...CREDENTIALS, WEBHOOK_EVENTS_PROCESS: "true", ZOHO_ARTWORK_SYNC_MODE: "live" };
    stubEnv({ ...live, APP_ENV: "production", STORAGE_DRIVER: "local" });
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
    expect(JSON.stringify(errors.mock.calls)).toContain("STORAGE_DRIVER must be s3");
  });

  it("does not ask for S3 storage outside production", () => {
    stubEnv({
      ...CREDENTIALS,
      WEBHOOK_EVENTS_PROCESS: "true",
      ZOHO_ARTWORK_SYNC_MODE: "live",
      STORAGE_DRIVER: "local",
    });
    expect(loadWorkerEnv().ZOHO_ARTWORK_SYNC_MODE).toBe("live");
  });
});
