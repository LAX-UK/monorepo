import { listEnabledQueues, listWorkerHeartbeatKeys } from "@auction/queues";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../env.js";
import { queueRuntimeEnvFromWorkerEnv } from "./queue-runtime-env.js";

describe("queueRuntimeEnvFromWorkerEnv ATG sync", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("APP_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers no atg-sync queue or heartbeat while the flag is off", () => {
    const runtime = queueRuntimeEnvFromWorkerEnv(loadWorkerEnv());

    expect(runtime.atgSyncEnabled).toBe(false);
    expect(listEnabledQueues(runtime).map((q) => q.name)).not.toContain("atg-sync");
    expect(listWorkerHeartbeatKeys(runtime)).not.toContain("worker:heartbeat:atg-sync");
  });

  it("adds the atg-sync queue and readiness heartbeat when the flag is on", () => {
    vi.stubEnv("ATG_SYNC_ENABLED", "true");
    vi.stubEnv("ATG_API_USERNAME", "api@example.test");
    vi.stubEnv("ATG_API_PASSWORD", "not-a-real-password");
    vi.stubEnv("ATG_PLATFORM_CODE", "LAX");
    vi.stubEnv("ATG_INCREMENT_SET_ID", "8d3c1f2e-4b5a-4c6d-8e7f-9a0b1c2d3e4f");
    vi.stubEnv("ATG_DEFAULT_CATEGORY", "Fine Art");
    vi.stubEnv("S3_PUBLIC_BASE_URL", "https://media.example.test");

    const runtime = queueRuntimeEnvFromWorkerEnv(loadWorkerEnv());

    expect(listEnabledQueues(runtime).map((q) => q.name)).toContain("atg-sync");
    expect(listWorkerHeartbeatKeys(runtime)).toContain("worker:heartbeat:atg-sync");
  });

  it("refuses to start with the flag on and credentials missing", () => {
    vi.stubEnv("ATG_SYNC_ENABLED", "true");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => loadWorkerEnv()).toThrow("Invalid worker environment variables");
    expect(JSON.stringify(logged.mock.calls)).toContain("required when ATG_SYNC_ENABLED=true");
  });
});
