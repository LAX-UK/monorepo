import { describe, expect, it } from "vitest";
import { PRODUCTS } from "./document.js";
import {
  MODES,
  type Mode,
  type ProductSwitch,
  type SwitchConfig,
  liveSourceOf,
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
    expect(liveSourceOf(sw("live", "off"))).toBe("xero");
    expect(liveSourceOf(sw("off", "off"))).toBe("none");
  });
  it("refuses two live sources with a message naming the product", () => {
    expect(validateProductSwitch("shop", sw("live", "live"))).toMatchObject({
      ok: false,
      refusal: { code: "two_live_sources", message: expect.stringContaining("shop") },
    });
    expect(() => liveSourceOf(sw("live", "live"))).toThrow();
  });
  it("refuses an unknown mode", () => {
    expect(validateProductSwitch("bid", sw("on" as Mode, "off"))).toMatchObject({
      refusal: { code: "bad_mode" },
    });
  });
  it("validates each product independently and reports the first failure", () => {
    expect(
      validateSwitchConfig({ ...all(sw("live", "off")), lax_art: sw("off", "live") }, PRODUCTS),
    ).toEqual({
      ok: true,
      value: { bid: "xero", shop: "xero", lax_art: "books" },
    });
    expect(
      validateSwitchConfig({ ...all(sw("live", "off")), shop: sw("live", "live") }, PRODUCTS),
    ).toMatchObject({
      ok: false,
      refusal: { code: "two_live_sources" },
    });
  });
  it("only live sends for real", () => {
    for (const m of MODES) expect(sendsForReal(sw(m, "off"), "xero")).toBe(m === "live");
  });
});
