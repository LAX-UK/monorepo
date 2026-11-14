import { afterEach, describe, expect, it, vi } from "vitest";

describe("instrumentation register", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("starts no SDK when no DSN is set", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SENTRY_DSN_ACCOUNT", "");
    const init = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    const { register } = await import("../instrumentation");
    await expect(register()).resolves.toBeUndefined();
    expect(init).not.toHaveBeenCalled();
  });

  it("initialises the SDK with PII off when the DSN is set", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SENTRY_DSN_ACCOUNT", "https://key@o0.ingest.sentry.io/1");
    const init = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    const { register } = await import("../instrumentation");
    await register();
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://key@o0.ingest.sentry.io/1", sendDefaultPii: false }),
    );
  });
});
