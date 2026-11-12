import { describe, expect, it } from "vitest";
import {
  MODES,
  type Mode,
  type ProductSwitch,
  type SwitchConfig,
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
