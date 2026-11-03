import { describe, expect, it } from "vitest";
import {
  ADMIN_FLASH_COOKIE,
  type FlashCookieJar,
  clearAdminFlash,
  isFlashablePath,
  readAdminFlash,
  writeAdminFlash,
} from "./flash-cookie";

const ENV = { key: Buffer.alloc(32, 3), nowMs: 1_700_000_000_000, secure: true };
const PATH = "/admin/clients";

type Stored = { name: string; value: string; path: string; maxAge: number; secure: boolean };

/** A jar that behaves like a browser: one cookie per name and path; a zero max-age removes it. */
function fakeJar() {
  const stored: Stored[] = [];
  const sets: { options: Record<string, unknown> }[] = [];
  const jar: FlashCookieJar = {
    getAll: (name) => stored.filter((c) => c.name === name),
    set: (name, value, options) => {
      sets.push({ options });
      const at = stored.findIndex((c) => c.name === name && c.path === options.path);
      if (at >= 0) stored.splice(at, 1);
      if (options.maxAge > 0) stored.push({ name, value, ...options });
    },
  };
  return { jar, stored, sets };
}

describe("admin flash cookie", () => {
  it("stores a short-lived, HttpOnly, SameSite=Lax cookie scoped to the page", () => {
    const { jar, sets } = fakeJar();
    expect(writeAdminFlash(jar, ENV, { kind: "error", message: "Not allowed.", path: PATH })).toBe(
      true,
    );
    expect(sets[0]?.options).toEqual({
      path: PATH,
      maxAge: 60,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });

  it("reads the message back for its path, once it has been cleared it is gone", () => {
    const { jar } = fakeJar();
    writeAdminFlash(jar, ENV, { kind: "success", message: "Saved.", path: PATH });
    expect(readAdminFlash(jar, ENV, PATH)).toEqual({ kind: "success", message: "Saved." });

    clearAdminFlash(jar, ENV, PATH);
    expect(readAdminFlash(jar, ENV, PATH)).toBeNull();
  });

  it("shows nothing on a different path", () => {
    const { jar } = fakeJar();
    writeAdminFlash(jar, ENV, { kind: "error", message: "No.", path: PATH });
    expect(readAdminFlash(jar, ENV, "/admin/payments")).toBeNull();
  });

  it("skips a stale copy for another path and finds the one for this page", () => {
    const { jar } = fakeJar();
    writeAdminFlash(jar, ENV, { kind: "error", message: "Parent.", path: "/admin/clients" });
    writeAdminFlash(jar, ENV, { kind: "error", message: "Child.", path: "/admin/clients/abc" });
    expect(readAdminFlash(jar, ENV, "/admin/clients/abc")?.message).toBe("Child.");
  });

  it("ignores a cookie with a tampered value", () => {
    const { jar, stored } = fakeJar();
    stored.push({
      name: ADMIN_FLASH_COOKIE,
      value: "v1.e30.AAAA",
      path: PATH,
      maxAge: 60,
      secure: true,
    });
    expect(readAdminFlash(jar, ENV, PATH)).toBeNull();
  });

  it("ignores an expired message", () => {
    const { jar } = fakeJar();
    writeAdminFlash(jar, ENV, { kind: "error", message: "Old.", path: PATH });
    expect(readAdminFlash(jar, { ...ENV, nowMs: ENV.nowMs + 61_000 }, PATH)).toBeNull();
  });

  it("refuses to store for a path that is not a clean staff path", () => {
    const { jar, stored } = fakeJar();
    for (const path of [
      "/",
      "/login",
      "/admin/../x",
      "/admin/a?b=1",
      "/administrator",
      "https://x.test/admin",
    ]) {
      expect(writeAdminFlash(jar, ENV, { kind: "error", message: "No.", path })).toBe(false);
    }
    expect(stored).toHaveLength(0);
  });

  it("stores nothing for an empty message", () => {
    const { jar, stored } = fakeJar();
    expect(writeAdminFlash(jar, ENV, { kind: "error", message: " ", path: PATH })).toBe(false);
    expect(stored).toHaveLength(0);
  });
});

describe("isFlashablePath", () => {
  it("accepts staff pages and rejects everything else", () => {
    expect(isFlashablePath("/admin")).toBe(true);
    expect(isFlashablePath("/admin/saleroom/abc%20d")).toBe(true);
    expect(isFlashablePath("/admin/./x")).toBe(false);
    expect(isFlashablePath("/admin/x y")).toBe(false);
    expect(isFlashablePath(`/admin/${"a".repeat(400)}`)).toBe(false);
  });
});
