import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportImageFallback, resetImageFallbackReports } from "./report-image-fallback";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

describe("reportImageFallback", () => {
  beforeEach(() => {
    resetImageFallbackReports();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it("warns once per page, with the picture's host and the page's path only", () => {
    reportImageFallback("https://cdn.example.com/a.jpg?token=secret", "/lot/harbour/1");
    reportImageFallback("https://cdn.example.com/b.jpg", "/lot/harbour/1");
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = vi.mocked(Sentry.captureMessage).mock.calls[0] ?? [];
    expect(message).toBe("Resized image refused, original used");
    expect(context).toMatchObject({
      level: "warning",
      fingerprint: ["resized-image-fallback", "cdn.example.com"],
      extra: { page: "/lot/harbour/1", host: "cdn.example.com" },
    });
    expect(JSON.stringify(context)).not.toContain("secret");
  });

  it("warns again for another page", () => {
    reportImageFallback("https://cdn.example.com/a.jpg", "/");
    reportImageFallback("https://cdn.example.com/a.jpg", "/results");
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it("reports a picture on this site by its path's host, not a failure to read it", () => {
    reportImageFallback("/media/a.jpg", "/");
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]?.[1]).toMatchObject({
      extra: { host: "site.invalid" },
    });
  });
});
