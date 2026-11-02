import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

function requestFor(host: string, pathname: string): NextRequest {
  return new NextRequest(new URL(`https://${host}${pathname}`));
}

async function redirectLocation(response: Response): Promise<string | null> {
  if (response.status < 300 || response.status >= 400) return null;
  return response.headers.get("location");
}

describe("middleware org module redirects", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "/onboarding/organisation",
    "/onboarding/organisation/step-1",
    "/organisations/invitations",
    "/organisations/invitations/abc",
    "/organisation/documents",
    "/organisation",
    "/organisation/members",
  ])("does not redirect %s on lax.bid (org module launched)", async (pathname) => {
    const response = await middleware(requestFor("lax.bid", pathname));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });

  it.each([
    "/onboarding/organisation",
    "/organisations/invitations/abc",
    "/organisation/documents",
    "/organisation",
  ])("redirects %s when NEXT_PUBLIC_FORCE_ORG_MODULE=hidden (kill switch)", async (pathname) => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    const response = await middleware(requestFor("lax.bid", pathname));
    expect(response.status).toBe(307);
    expect(await redirectLocation(response)).toBe("https://lax.bid/organisations");
  });

  it("does not redirect /organisations hub when kill switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    const response = await middleware(requestFor("lax.bid", "/organisations"));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });

  it.each([
    "/onboarding/organisation",
    "/organisations/invitations/abc",
    "/organisation/documents",
  ])("does not redirect %s on test.lax.bid", async (pathname) => {
    const response = await middleware(requestFor("test.lax.bid", pathname));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });

  it.each([
    "/onboarding/organisation",
    "/organisations/invitations/abc",
    "/organisation/documents",
  ])("does not redirect %s on localhost", async (pathname) => {
    const response = await middleware(requestFor("localhost:3000", pathname));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });
});

describe("middleware request path headers", () => {
  it("passes the admin page and its query on, so sign-in can return to it", async () => {
    const response = await middleware(requestFor("lax.bid", "/admin/lots?status=draft"));
    expect(response.headers.get("x-middleware-request-x-pathname")).toBe("/admin/lots");
    expect(response.headers.get("x-middleware-request-x-search")).toBe("?status=draft");
  });

  it("does not pass the path on for public pages", async () => {
    const response = await middleware(requestFor("lax.bid", "/lots"));
    expect(response.headers.get("x-middleware-request-x-pathname")).toBeNull();
  });
});

describe("middleware archive redirect", () => {
  it("moves the old archive to the Lots view with a permanent redirect, keeping its filters", async () => {
    const response = await middleware(requestFor("lax.bid", "/archive?year=2026&sort=recent"));
    expect(response.status).toBe(301);
    expect(await redirectLocation(response)).toBe(
      "https://lax.bid/results?view=lots&year=2026&sort=recent",
    );
  });
});
