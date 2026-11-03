import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../env.js";
import { subjectExportConfigFromEnv } from "./subject-export.config.js";

const ALL = {
  IDENTITY_INTERNAL_BASE_URL: "https://identity.internal",
  SHOP_API_INTERNAL_BASE_URL: "https://shop-api.internal",
  API_INTERNAL_BASE_URL: "https://api.internal",
  SUBJECT_EXPORT_MACHINE_CLIENT_ID: "subject-export-worker",
  SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "x".repeat(32),
  IDENTITY_SUBJECT_EXPORT_CLIENT_ID: "subject-export",
  IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: "y".repeat(32),
  SUBJECT_EXPORT_BUCKET: "lax-subject-exports",
  SUBJECT_EXPORT_REGION: "eu-west-2",
  SUBJECT_EXPORT_WRITE_ACCESS_KEY_ID: "AKIAEXPORT",
  SUBJECT_EXPORT_WRITE_SECRET_ACCESS_KEY: "write-secret",
};

function stub(values: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("APP_ENV", "development");
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("Download my data settings", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off when none are set", () => {
    stub({});
    expect(subjectExportConfigFromEnv(loadWorkerEnv())).toBeNull();
  });

  it("collects the addresses, both credential sets and the bucket write keys", () => {
    stub({ ...ALL, SUBJECT_EXPORT_ENDPOINT: "http://localhost:9000" });
    expect(subjectExportConfigFromEnv(loadWorkerEnv())).toEqual({
      identityBaseUrl: "https://identity.internal",
      bidBaseUrl: "https://api.internal",
      shopBaseUrl: "https://shop-api.internal",
      identityClient: { id: "subject-export-worker", secret: "x".repeat(32) },
      productClient: { id: "subject-export", secret: "y".repeat(32) },
      bucket: {
        bucket: "lax-subject-exports",
        region: "eu-west-2",
        endpoint: "http://localhost:9000",
        accessKeyId: "AKIAEXPORT",
        secretAccessKey: "write-secret",
      },
    });
  });

  it("refuses to start with only some of them, naming what is needed", () => {
    stub({ ...ALL, SUBJECT_EXPORT_BUCKET: "" });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
    expect(JSON.stringify(report.mock.calls)).toContain("Download my data needs all of");
    report.mockRestore();
  });

  it("refuses a weak secret", () => {
    stub({ ...ALL, SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "short" });
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadWorkerEnv()).toThrow();
    report.mockRestore();
  });
});
