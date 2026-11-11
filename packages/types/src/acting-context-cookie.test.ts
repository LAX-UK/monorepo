import { describe, expect, it } from "vitest";
import {
  type ActingContextCookieV1,
  decodeActingContextCookie,
  encodeActingContextCookie,
} from "./acting-context-cookie.js";

const ENTITY = "2f0c0a7e-6b2e-4c8e-9a41-0a9d1d6f4b11";
const SESSION = "9b1d3c52-77aa-4f0e-8d2c-5e6f7a8b9c0d";

describe("acting context cookie", () => {
  it.each<ActingContextCookieV1>([
    { v: 1, e: ENTITY },
    { v: 1, e: ENTITY, n: "Galerie Zoë — München 🎨" },
    { v: 1, e: ENTITY, n: "Acme", i: { sid: SESSION } },
  ])("encodes to the bytes Buffer produced and decodes back: %j", (payload) => {
    const encoded = encodeActingContextCookie(payload);
    expect(encoded).toBe(Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"));
    expect(decodeActingContextCookie(encoded)).toEqual(payload);
  });

  it("still accepts a plain uuid", () => {
    expect(decodeActingContextCookie(ENTITY)).toEqual({ v: 1, e: ENTITY });
  });

  it("rejects values that are not a cookie", () => {
    expect(decodeActingContextCookie("not-a-cookie")).toBeNull();
    expect(decodeActingContextCookie("!!!")).toBeNull();
    expect(decodeActingContextCookie("")).toBeNull();
  });
});
