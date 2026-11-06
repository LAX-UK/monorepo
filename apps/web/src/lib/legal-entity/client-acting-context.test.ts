import { encodeActingContextCookie } from "@auction/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expireSharedActingCookie,
  parseActingLegalEntityId,
  readActingCookie,
  setClientActingLegalEntityId,
} from "./client-acting-context";

const ENTITY_ID = "11111111-1111-4111-8111-111111111111";

/** Records every `document.cookie = ...` write so Domain attributes can be asserted. */
function recordCookieWrites(): string[] {
  const writes: string[] = [];
  vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
    writes.push(value);
  });
  return writes;
}

describe("acting legal entity cookie", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("is written host-only even when a shared cookie domain is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ".lax.bid");
    const writes = recordCookieWrites();

    setClientActingLegalEntityId(ENTITY_ID);

    const set = writes.find((w) => w.includes(ENTITY_ID));
    expect(set).toBeDefined();
    expect(set?.toLowerCase()).not.toContain("domain=");
  });

  it("expires the shared copy older deployments set, and only that copy", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ".lax.bid");
    const writes = recordCookieWrites();

    setClientActingLegalEntityId(ENTITY_ID);

    const shared = writes.filter((w) => w.toLowerCase().includes("domain=.lax.bid"));
    expect(shared).toHaveLength(1);
    expect(shared[0]).toContain("lax_acting_legal_entity_id=;");
    expect(shared[0]).toContain("expires=Thu, 01 Jan 1970");
  });

  it("writes nothing for the shared copy when no cookie domain is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "");
    const writes = recordCookieWrites();

    expireSharedActingCookie();

    expect(writes).toEqual([]);
  });

  it("clears the host-only cookie when the id is null", () => {
    vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "");
    const writes = recordCookieWrites();

    setClientActingLegalEntityId(null);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("lax_acting_legal_entity_id=;");
    expect(writes[0]).toContain("expires=Thu, 01 Jan 1970");
  });

  it("still reads a host-only cookie from the document cookie string", () => {
    expect(parseActingLegalEntityId(`theme=dark; lax_acting_legal_entity_id=${ENTITY_ID}`)).toBe(
      ENTITY_ID,
    );
  });
});

describe("readActingCookie", () => {
  const VIEW_ID = "22222222-2222-4222-8222-222222222222";

  it("reads a bare account id", () => {
    expect(readActingCookie(ENTITY_ID)).toEqual({ accountId: ENTITY_ID, viewSessionId: null });
  });

  it("reads the encoded form, with a staff view session", () => {
    const value = encodeActingContextCookie({ v: 1, e: ENTITY_ID, i: { sid: VIEW_ID } });
    expect(readActingCookie(value)).toEqual({ accountId: ENTITY_ID, viewSessionId: VIEW_ID });
  });

  it("URL-decodes first, so a header value and a decoded value read alike", () => {
    expect(readActingCookie(encodeURIComponent(` ${ENTITY_ID} `))?.accountId).toBe(ENTITY_ID);
  });

  it("returns null for nothing, or for a value it cannot read", () => {
    expect(readActingCookie(undefined)).toBeNull();
    expect(readActingCookie("")).toBeNull();
    expect(readActingCookie("not-an-account")).toBeNull();
    expect(readActingCookie("%E0%A4%A")).toBeNull();
  });
});
