import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isIndexingAllowedAtBuildTime,
  isIndexingAllowedForHost,
  withIndexingPolicy,
} from "./is-indexing-allowed";

describe("isIndexingAllowedForHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows production hosts", () => {
    expect(isIndexingAllowedForHost("lax.bid")).toBe(true);
    expect(isIndexingAllowedForHost("www.lax.bid")).toBe(true);
  });

  it("blocks test and local hosts by default", () => {
    expect(isIndexingAllowedForHost("test.lax.bid")).toBe(false);
    expect(isIndexingAllowedForHost("test-api.lax.bid")).toBe(false);
    expect(isIndexingAllowedForHost("localhost")).toBe(false);
  });

  it("respects NEXT_PUBLIC_ALLOW_INDEXING", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "false");
    expect(isIndexingAllowedForHost("lax.bid")).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "true");
    expect(isIndexingAllowedForHost("test.lax.bid")).toBe(true);
  });

  it("respects NEXT_PUBLIC_FORCE_INDEXING override", () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_INDEXING", "hidden");
    expect(isIndexingAllowedForHost("lax.bid")).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_FORCE_INDEXING", "visible");
    expect(isIndexingAllowedForHost("test.lax.bid")).toBe(true);
  });
});

describe("isIndexingAllowedAtBuildTime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives from NEXT_PUBLIC_WEB_ORIGIN when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://test.lax.bid");
    expect(isIndexingAllowedAtBuildTime()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://lax.bid");
    expect(isIndexingAllowedAtBuildTime()).toBe(true);
  });

  it("blocks localhost when no origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(isIndexingAllowedAtBuildTime()).toBe(false);
  });

  it("prefers NEXT_PUBLIC_ALLOW_INDEXING over origin", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://test.lax.bid");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "true");
    expect(isIndexingAllowedAtBuildTime()).toBe(true);
  });
});

describe("withIndexingPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds noindex robots on non-production builds", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://test.lax.bid");
    expect(withIndexingPolicy({ title: "Lots" })).toEqual({
      title: "Lots",
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    });
  });

  it("leaves metadata unchanged on production builds", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://lax.bid");
    const metadata = { title: "Lots" };
    expect(withIndexingPolicy(metadata)).toBe(metadata);
  });
});
