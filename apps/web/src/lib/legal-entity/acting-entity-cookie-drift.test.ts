import { encodeActingContextCookie } from "@auction/types";
import { describe, expect, it } from "vitest";
import { detectActingEntityCookieDrift } from "./acting-entity-cookie-drift";

const PERSONAL = "10000000-0000-4000-8000-000000000003";
const OTHER = "10000000-0000-4000-8000-000000000007";

describe("detectActingEntityCookieDrift", () => {
  it("returns null when server acting id is absent", () => {
    expect(detectActingEntityCookieDrift(null)).toBeNull();
    expect(detectActingEntityCookieDrift(undefined)).toBeNull();
  });

  it("reports no drift when cookie matches server acting id", () => {
    const cookie = `lax_acting_legal_entity_id=${PERSONAL}`;
    const r = detectActingEntityCookieDrift(PERSONAL, cookie);
    expect(r?.hasDrift).toBe(false);
    expect(r?.cookieActingId).toBe(PERSONAL);
  });

  it("reports drift when cookie points at another entity (stale session)", () => {
    const cookie = `lax_acting_legal_entity_id=${OTHER}`;
    const r = detectActingEntityCookieDrift(PERSONAL, cookie);
    expect(r?.hasDrift).toBe(true);
    expect(r?.serverActingId).toBe(PERSONAL);
    expect(r?.cookieActingId).toBe(OTHER);
  });

  it("reports no drift when cookie is absent (bid route falls back to personal)", () => {
    const r = detectActingEntityCookieDrift(PERSONAL, "");
    expect(r?.hasDrift).toBe(false);
    expect(r?.cookieActingId).toBeUndefined();
  });

  it("flags reconcile when cookie is stale", () => {
    const r = detectActingEntityCookieDrift(PERSONAL, `lax_acting_legal_entity_id=${OTHER}`);
    expect(r?.shouldReconcile).toBe(true);
  });

  it("flags reconcile when cookie is absent so the client can seed it", () => {
    const r = detectActingEntityCookieDrift(PERSONAL, "");
    expect(r?.shouldReconcile).toBe(true);
  });

  it("does not reconcile when cookie already matches", () => {
    const r = detectActingEntityCookieDrift(PERSONAL, `lax_acting_legal_entity_id=${PERSONAL}`);
    expect(r?.shouldReconcile).toBe(false);
  });

  it("never reconciles or flags drift for an impersonation cookie", () => {
    const impersonation = encodeActingContextCookie({
      v: 1,
      e: OTHER,
      i: { sid: "22222222-2222-4222-8222-222222222222" },
    });
    const r = detectActingEntityCookieDrift(
      PERSONAL,
      `lax_acting_legal_entity_id=${impersonation}`,
    );
    expect(r?.isImpersonation).toBe(true);
    expect(r?.hasDrift).toBe(false);
    expect(r?.shouldReconcile).toBe(false);
  });
});
