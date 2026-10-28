import { describe, expect, it } from "vitest";
import { resolveBandSequence } from "./marketing-band-sequence.js";

describe("resolveBandSequence", () => {
  it("keeps bands that alternate with plain sections", () => {
    expect(
      resolveBandSequence([
        { id: "a", surface: "band", flexible: true },
        { id: "b", surface: "plain", flexible: false },
        { id: "c", surface: "band", flexible: false },
      ]),
    ).toEqual({ a: "band", b: "plain", c: "band" });
  });

  it("puts a flexible band on the page when it follows another band", () => {
    expect(
      resolveBandSequence([
        { id: "team", surface: "band", flexible: false },
        { id: "related", surface: "band", flexible: true },
      ]),
    ).toEqual({ team: "band", related: "plain" });
  });

  it("gives way before a fixed band when the earlier band is the flexible one", () => {
    expect(
      resolveBandSequence([
        { id: "guide", surface: "band", flexible: true },
        { id: "team", surface: "band", flexible: false },
      ]),
    ).toEqual({ guide: "plain", team: "band" });
  });

  it("leaves two fixed bands as they are", () => {
    expect(
      resolveBandSequence([
        { id: "a", surface: "band", flexible: false },
        { id: "b", surface: "band", flexible: false },
      ]),
    ).toEqual({ a: "band", b: "band" });
  });
});
