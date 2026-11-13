import { describe, expect, it } from "vitest";
import { prepareCrmEmail } from "./crm-email.js";

describe("prepareCrmEmail", () => {
  it("trims the address and lower-cases the domain only", () => {
    expect(prepareCrmEmail("  Ada.Lovelace@Example.COM\n")).toEqual({
      ok: true,
      email: "Ada.Lovelace@example.com",
    });
  });

  it("keeps plus-addressing", () => {
    expect(prepareCrmEmail("ada+news@example.com")).toEqual({
      ok: true,
      email: "ada+news@example.com",
    });
  });

  it("sends an internationalised domain in its ASCII form", () => {
    expect(prepareCrmEmail("ada@bücher.example")).toEqual({
      ok: true,
      email: "ada@xn--bcher-kva.example",
    });
  });

  it("drops a trailing dot on the domain", () => {
    expect(prepareCrmEmail("ada@example.com.")).toEqual({ ok: true, email: "ada@example.com" });
  });

  it("refuses a local part over 64 characters", () => {
    expect(prepareCrmEmail(`${"a".repeat(65)}@example.com`)).toEqual({
      ok: false,
      problem: "local_part_too_long",
    });
    expect(prepareCrmEmail(`${"a".repeat(64)}@example.com`).ok).toBe(true);
  });

  it("refuses an address over Zoho's 100 characters", () => {
    expect(prepareCrmEmail(`${"a".repeat(60)}@${"b".repeat(40)}.com`)).toEqual({
      ok: false,
      problem: "too_long",
    });
  });

  it("refuses characters outside plain ASCII before the @", () => {
    expect(prepareCrmEmail("josé@example.com")).toEqual({
      ok: false,
      problem: "invalid_local_part",
    });
    expect(prepareCrmEmail("a b@example.com")).toEqual({
      ok: false,
      problem: "invalid_local_part",
    });
    expect(prepareCrmEmail("a..b@example.com")).toEqual({
      ok: false,
      problem: "invalid_local_part",
    });
  });

  it("refuses a missing or malformed domain", () => {
    expect(prepareCrmEmail("ada@localhost")).toEqual({ ok: false, problem: "invalid_domain" });
    expect(prepareCrmEmail("ada@-example.com")).toEqual({ ok: false, problem: "invalid_domain" });
    expect(prepareCrmEmail("ada@")).toEqual({ ok: false, problem: "invalid_local_part" });
    expect(prepareCrmEmail("   ")).toEqual({ ok: false, problem: "missing" });
  });
});
