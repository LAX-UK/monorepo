import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function requestFor(host: string, pathname: string): NextRequest {
  return new NextRequest(new URL(`https://${host}${pathname}`));
}

async function redirectLocation(response: Response): Promise<string | null> {
  if (response.status < 300 || response.status >= 400) return null;
  return response.headers.get("location");
}

describe("middleware org module redirects", () => {
  it.each([
    "/onboarding/organisation",
    "/onboarding/organisation/step-1",
    "/dashboard/invitations",
    "/dashboard/invitations/abc",
    "/dashboard/organisations/abc",
    "/dashboard/organisations/abc/members",
  ])("redirects %s on lax.bid to /dashboard/organisations", async (pathname) => {
    const response = await middleware(requestFor("lax.bid", pathname));
    expect(response.status).toBe(307);
    expect(await redirectLocation(response)).toBe("https://lax.bid/dashboard/organisations");
  });

  it("does not redirect /dashboard/organisations hub on lax.bid", async () => {
    const response = await middleware(requestFor("lax.bid", "/dashboard/organisations"));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });

  it.each([
    "/onboarding/organisation",
    "/dashboard/invitations/abc",
    "/dashboard/organisations/abc",
  ])("does not redirect %s on test.lax.bid", async (pathname) => {
    const response = await middleware(requestFor("test.lax.bid", pathname));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });

  it.each([
    "/onboarding/organisation",
    "/dashboard/invitations/abc",
    "/dashboard/organisations/abc",
  ])("does not redirect %s on localhost", async (pathname) => {
    const response = await middleware(requestFor("localhost:3000", pathname));
    expect(response.status).toBe(200);
    expect(await redirectLocation(response)).toBeNull();
  });
});
