import { ACTING_LEGAL_ENTITY_COOKIE_NAME, encodeActingContextCookie } from "@auction/types";
import { describe, expect, it } from "vitest";
import { viewSessionCookieHeader } from "./view-session-cookie";

const ENTITY = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const SESSION = "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d";
const view = encodeActingContextCookie({ v: 1, e: ENTITY, i: { sid: SESSION } });
const name = ACTING_LEGAL_ENTITY_COOKIE_NAME;

describe("viewSessionCookieHeader", () => {
  it("returns only the view-session cookie, by exact name", () => {
    expect(viewSessionCookieHeader(`identity=secret; ${name}=${view}; other=1`)).toBe(
      `${name}=${view}`,
    );
  });

  it("ignores cookies whose name only contains the acting name", () => {
    expect(viewSessionCookieHeader(`x${name}=${view}; ${name}x=${view}`)).toBeNull();
  });

  it("does not forward the plain account choice", () => {
    expect(viewSessionCookieHeader(`${name}=${ENTITY}`)).toBeNull();
    expect(
      viewSessionCookieHeader(`${name}=${encodeActingContextCookie({ v: 1, e: ENTITY })}`),
    ).toBeNull();
  });

  it("does not forward malformed or unsafe values", () => {
    expect(viewSessionCookieHeader(`${name}=not-a-cookie`)).toBeNull();
    expect(viewSessionCookieHeader(`${name}=${view}%0d%0ax`)).toBeNull();
    expect(viewSessionCookieHeader(`${name}=`)).toBeNull();
    expect(viewSessionCookieHeader(`${name}=${"a".repeat(513)}`)).toBeNull();
    expect(viewSessionCookieHeader(null)).toBeNull();
    expect(viewSessionCookieHeader("")).toBeNull();
  });
});
