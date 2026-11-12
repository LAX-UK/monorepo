import { ACTING_LEGAL_ENTITY_COOKIE_NAME, encodeActingContextCookie } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let cookieHeader: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(cookieHeader ? { cookie: cookieHeader } : undefined),
}));
vi.mock("@/lib/bff/token-service.server", () => ({ BidBffTokenService: class {} }));
vi.mock("@/lib/data/http/session.server", () => ({ getServerSessionUser: async () => null }));
vi.mock("@/lib/legal-entity/acting-context.server", () => ({
  getActingLegalEntityHeader: async () => ({}),
}));

import { buildAuthedSsrHeaders, withViewSessionCookie } from "./server-request-headers";

const view = encodeActingContextCookie({
  v: 1,
  e: "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
  i: { sid: "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d" },
});

describe("withViewSessionCookie", () => {
  beforeEach(() => {
    cookieHeader = null;
  });

  it("sends only the view-as-client cookie, by exact name", async () => {
    cookieHeader = `lax_bid_session=secret; ${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`;
    const headers = new Headers();
    await withViewSessionCookie()(headers);
    expect(headers.get("cookie")).toBe(`${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`);
  });

  it("uses the first of a duplicated cookie, as the BFF and the API do", async () => {
    cookieHeader = `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}; ${ACTING_LEGAL_ENTITY_COOKIE_NAME}=other`;
    const headers = new Headers();
    await withViewSessionCookie()(headers);
    expect(headers.get("cookie")).toBe(`${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`);
  });

  it("sends nothing for the plain account choice or no cookie", async () => {
    const headers = new Headers();
    await withViewSessionCookie()(headers);
    cookieHeader = `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f`;
    await withViewSessionCookie()(headers);
    expect(headers.has("cookie")).toBe(false);
  });

  it("sends the view session even when the acting header is skipped", async () => {
    cookieHeader = `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`;
    const headers = await buildAuthedSsrHeaders({
      skipActingLegalEntityHeader: true,
      consent: null,
    });
    expect(headers.get("cookie")).toBe(`${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${view}`);
  });
});
