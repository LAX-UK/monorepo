import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { CLIENT_WORKSPACE_COOKIE } from "./client-workspace-mode";
import { syncClientWorkspaceCookie } from "./sync-client-workspace-cookie";

function sync(pathname: string, cookie?: "buying" | "selling"): string | undefined {
  const request = new NextRequest(`https://lax.bid${pathname}`, {
    headers: cookie ? { cookie: `${CLIENT_WORKSPACE_COOKIE}=${cookie}` } : {},
  });
  const response = NextResponse.next();
  syncClientWorkspaceCookie(request, response);
  return response.cookies.get(CLIENT_WORKSPACE_COOKIE)?.value;
}

describe("syncClientWorkspaceCookie", () => {
  it("switches to selling when a Selling page is opened from buying", () => {
    expect(sync("/dashboard/seller", "buying")).toBe("selling");
    expect(sync("/dashboard/seller/organisations/org-1/members", "buying")).toBe("selling");
    expect(sync("/dashboard/seller/works")).toBe("selling");
  });

  it("switches back to buying when Back to buying is followed", () => {
    expect(sync("/dashboard/bids", "selling")).toBe("buying");
    expect(sync("/dashboard/purchases", "selling")).toBe("buying");
  });

  it("leaves the cookie alone on pages that belong to neither mode", () => {
    expect(sync("/dashboard/notifications", "selling")).toBeUndefined();
    expect(sync("/dashboard/settings/bidding", "buying")).toBeUndefined();
  });

  it("does nothing outside the dashboard", () => {
    expect(sync("/sales", "selling")).toBeUndefined();
  });
});
