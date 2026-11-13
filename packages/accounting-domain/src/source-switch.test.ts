import { describe, expect, it } from "vitest";
import {
  MODES,
  type Mode,
  type ProductSwitch,
  type SwitchConfig,
  booksTargetMode,
  documentTarget,
  mayClaim,
  parseSwitchConfig,
  sendsForReal,
  validateProductSwitch,
  validateSwitchConfig,
} from "./source-switch.js";

const sw = (xero: Mode, books: Mode): ProductSwitch => ({ xero, books });
const all = (p: ProductSwitch): SwitchConfig => ({ bid: p, shop: p, lax_art: p });

describe("source switch policy", () => {
  it("every pair of modes is valid unless both are live", () => {
    for (const xero of MODES) {
      for (const books of MODES) {
        const r = validateProductSwitch("bid", sw(xero, books));
        expect(r.ok).toBe(!(xero === "live" && books === "live"));
      }
    }
  });
  it("names the single live source, or none", () => {
    expect(validateProductSwitch("bid", sw("live", "dry_run"))).toEqual({
      ok: true,
      value: "xero",
    });
    expect(validateProductSwitch("bid", sw("off", "live"))).toEqual({ ok: true, value: "books" });
    expect(validateProductSwitch("bid", sw("off", "test_org"))).toEqual({
      ok: true,
      value: "none",
    });
  });
  it("refuses two live sources with a message naming the product", () => {
    expect(validateProductSwitch("shop", sw("live", "live"))).toMatchObject({
      ok: false,
      refusal: { code: "two_live_sources", message: expect.stringContaining("shop") },
    });
  });
  it("refuses an unknown mode", () => {
    expect(validateProductSwitch("bid", sw("on" as Mode, "off"))).toMatchObject({
      refusal: { code: "bad_mode" },
    });
  });
  it("validates each product independently and reports the first failure", () => {
    expect(validateSwitchConfig({ ...all(sw("live", "off")), lax_art: sw("off", "live") })).toEqual(
      {
        ok: true,
        value: { bid: "xero", shop: "xero", lax_art: "books" },
      },
    );
    expect(
      validateSwitchConfig({ ...all(sw("live", "off")), shop: sw("live", "live") }),
    ).toMatchObject({
      ok: false,
      refusal: { code: "two_live_sources" },
    });
  });
  it("covers every product: a missing one is a typed refusal, never a throw", () => {
    for (const missing of ["bid", "shop", "lax_art"] as const) {
      const { [missing]: _gone, ...rest } = all(sw("off", "off"));
      expect(validateSwitchConfig(rest)).toMatchObject({
        ok: false,
        refusal: { code: "missing_product", message: expect.stringContaining(missing) },
      });
    }
    expect(validateSwitchConfig(undefined).ok).toBe(false);
    expect(validateSwitchConfig(null).ok).toBe(false);
    expect(validateSwitchConfig({ ...all(sw("off", "off")), shop: undefined })).toMatchObject({
      refusal: { code: "missing_product" },
    });
  });
  it("two live sources on Shop are caught however the config is built", () => {
    expect(
      validateSwitchConfig({
        bid: sw("off", "off"),
        shop: sw("live", "live"),
        lax_art: sw("off", "off"),
      }),
    ).toMatchObject({ refusal: { code: "two_live_sources" } });
  });
  it("parseSwitchConfig returns a config only when valid, copying the known fields", () => {
    expect(parseSwitchConfig({ ...all(sw("live", "off")), extra: 1 })).toEqual({
      ok: true,
      value: all(sw("live", "off")),
    });
    expect(parseSwitchConfig({ ...all(sw("off", "off")), bid: { xero: "off" } })).toMatchObject({
      refusal: { code: "bad_mode" },
    });
  });
  it("only live sends for real", () => {
    for (const m of MODES) expect(sendsForReal(sw(m, "off"), "xero")).toBe(m === "live");
  });
});

describe("document target", () => {
  it("aims a new document at the live source", () => {
    expect(documentTarget(sw("live", "test_org"))).toEqual({ provider: "xero", mode: "live" });
    expect(documentTarget(sw("dry_run", "live"))).toEqual({ provider: "books", mode: "live" });
  });
  it("aims at the only provider in rehearsal when none is live", () => {
    expect(documentTarget(sw("off", "test_org"))).toEqual({ provider: "books", mode: "test_org" });
    expect(documentTarget(sw("dry_run", "off"))).toEqual({ provider: "xero", mode: "dry_run" });
  });
  it("has no target when both are off or both are in rehearsal", () => {
    expect(documentTarget(sw("off", "off"))).toBeNull();
    expect(documentTarget(sw("dry_run", "test_org"))).toBeNull();
    expect(documentTarget(sw("test_org", "test_org"))).toBeNull();
  });
  it("is never a rehearsal while a provider is live", () => {
    for (const xero of MODES) {
      for (const books of MODES) {
        if (xero === "live" && books === "live") continue;
        const target = documentTarget(sw(xero, books));
        if (xero === "live" || books === "live") expect(target?.mode).toBe("live");
      }
    }
  });
  it("is claimed only by the provider and mode it was created for", () => {
    for (const xero of MODES) {
      for (const books of MODES) {
        if (xero === "live" && books === "live") continue;
        const now = sw(xero, books);
        for (const created of [
          sw("live", "test_org"),
          sw("test_org", "live"),
          sw("off", "dry_run"),
        ]) {
          const target = documentTarget(created);
          for (const provider of ["xero", "books"] as const) {
            const expected =
              target !== null && target.provider === provider && now[provider] === target.mode;
            expect(mayClaim(target, now, provider)).toBe(expected);
          }
        }
      }
    }
  });
  it("lets a test_org or dry_run claimer take nothing that was aimed live", () => {
    const live = documentTarget(sw("live", "test_org"));
    expect(mayClaim(live, sw("live", "test_org"), "books")).toBe(false);
    expect(mayClaim(live, sw("live", "dry_run"), "books")).toBe(false);
    expect(mayClaim(live, sw("test_org", "test_org"), "xero")).toBe(false);
    expect(mayClaim(live, sw("live", "test_org"), "xero")).toBe(true);
  });
  it("does not re-aim after a switch flip", () => {
    const target = documentTarget(sw("live", "off"));
    expect(mayClaim(target, sw("off", "live"), "books")).toBe(false);
    expect(mayClaim(target, sw("off", "live"), "xero")).toBe(false);
    expect(mayClaim(null, sw("live", "live"), "xero")).toBe(false);
  });
});

describe("Books target mode", () => {
  it("is Books' own mode only when the switch aims the product's documents at Books", () => {
    for (const xero of MODES) {
      for (const books of MODES) {
        if (xero === "live" && books === "live") continue;
        const target = documentTarget(sw(xero, books));
        expect(booksTargetMode(sw(xero, books))).toBe(
          target?.provider === "books" ? target.mode : null,
        );
      }
    }
  });
  it("takes nothing while Xero is live, whatever Books says", () => {
    for (const books of ["off", "dry_run", "test_org"] as const) {
      expect(booksTargetMode(sw("live", books))).toBeNull();
    }
  });
  it("rehearses only with Xero away from live and not rehearsing too", () => {
    expect(booksTargetMode(sw("off", "dry_run"))).toBe("dry_run");
    expect(booksTargetMode(sw("off", "test_org"))).toBe("test_org");
    expect(booksTargetMode(sw("dry_run", "dry_run"))).toBeNull();
    expect(booksTargetMode(sw("off", "off"))).toBeNull();
  });
});
