import { describe, expect, it } from "vitest";
import {
  ADMIN_FLASH_MAX_MESSAGE_LENGTH,
  ADMIN_FLASH_TTL_SECONDS,
  normaliseFlashMessage,
  signAdminFlash,
  verifyAdminFlash,
} from "./flash-token";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);
const PATH = "/admin/submissions/abc";
const NOW = 1_700_000_000_000;

function token(message = "The submission is locked.", path = PATH) {
  const value = signAdminFlash({ kind: "error", message, path }, KEY, NOW);
  if (!value) throw new Error("expected a token");
  return value;
}

describe("admin flash token", () => {
  it("round-trips the kind and message for its own path", () => {
    expect(verifyAdminFlash(token(), KEY, NOW + 1000, PATH)).toEqual({
      kind: "error",
      message: "The submission is locked.",
    });
  });

  it("returns nothing when the token is missing", () => {
    expect(verifyAdminFlash(undefined, KEY, NOW, PATH)).toBeNull();
    expect(verifyAdminFlash("", KEY, NOW, PATH)).toBeNull();
  });

  it("rejects a token signed with another key", () => {
    expect(verifyAdminFlash(token(), OTHER_KEY, NOW, PATH)).toBeNull();
  });

  it("rejects a token whose message was changed", () => {
    const [version, , signature] = token().split(".");
    const forged = Buffer.from(
      JSON.stringify({ k: "error", m: "Call 0800 000 000", p: PATH, e: NOW + 60_000 }),
    ).toString("base64url");
    expect(verifyAdminFlash(`${version}.${forged}.${signature}`, KEY, NOW, PATH)).toBeNull();
  });

  it("rejects a truncated or malformed token", () => {
    const value = token();
    expect(verifyAdminFlash(value.slice(0, -4), KEY, NOW, PATH)).toBeNull();
    expect(verifyAdminFlash("v1.only-two", KEY, NOW, PATH)).toBeNull();
    expect(verifyAdminFlash(value.replace("v1.", "v0."), KEY, NOW, PATH)).toBeNull();
  });

  it("rejects an expired token and accepts one up to its last moment", () => {
    const value = token();
    const expiry = NOW + ADMIN_FLASH_TTL_SECONDS * 1000;
    expect(verifyAdminFlash(value, KEY, expiry - 1, PATH)).not.toBeNull();
    expect(verifyAdminFlash(value, KEY, expiry, PATH)).toBeNull();
  });

  it("rejects a token meant for another path", () => {
    expect(verifyAdminFlash(token(), KEY, NOW, "/admin/submissions/other")).toBeNull();
    expect(verifyAdminFlash(token(), KEY, NOW, "/admin/submissions")).toBeNull();
  });

  it("signs nothing for an empty message", () => {
    expect(signAdminFlash({ kind: "error", message: "  \n", path: PATH }, KEY, NOW)).toBeNull();
  });
});

describe("normaliseFlashMessage", () => {
  it("strips control characters and trims", () => {
    expect(normaliseFlashMessage("  Not\u0000 allowed\u001f. ")).toBe("Not allowed.");
  });

  it("caps a long message", () => {
    const out = normaliseFlashMessage("a".repeat(ADMIN_FLASH_MAX_MESSAGE_LENGTH + 50));
    expect(out).toHaveLength(ADMIN_FLASH_MAX_MESSAGE_LENGTH + 1);
    expect(out?.endsWith("…")).toBe(true);
  });
});
