import { ADMIN_FLASH } from "@/lib/admin/flash/admin-flash";
import { describe, expect, it } from "vitest";
import { CLIENT_FLASH } from "./client-flash";
import { pathUnder } from "./flash-audience";
import { type FlashCookieJar, clearFlash, readFlash, writeFlash } from "./flash-cookie";

const ENV = { key: Buffer.alloc(32, 3), nowMs: 1_700_000_000_000, secure: true };
const PATH = "/selling/consignments/abc";

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

describe("flash cookie", () => {
  it("stores a short-lived, HttpOnly, SameSite=Lax cookie scoped to the page", () => {
    const { jar, sets, stored } = fakeJar();
    expect(
      writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "Not allowed.", path: PATH }),
    ).toBe(true);
    expect(sets[0]?.options).toEqual({
      path: PATH,
      maxAge: 60,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    expect(stored[0]?.name).toBe("lax-client-flash");
  });

  it("reads the message back for its path, once it has been cleared it is gone", () => {
    const { jar } = fakeJar();
    writeFlash(CLIENT_FLASH, jar, ENV, { kind: "success", message: "Saved.", path: PATH });
    expect(readFlash(CLIENT_FLASH, jar, ENV, PATH)).toEqual({ kind: "success", message: "Saved." });

    clearFlash(CLIENT_FLASH, jar, ENV, PATH);
    expect(readFlash(CLIENT_FLASH, jar, ENV, PATH)).toBeNull();
  });

  it("shows nothing on a different path", () => {
    const { jar } = fakeJar();
    writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "No.", path: PATH });
    expect(readFlash(CLIENT_FLASH, jar, ENV, "/selling/new")).toBeNull();
  });

  it("skips a stale copy for another path and finds the one for this page", () => {
    const { jar } = fakeJar();
    writeFlash(CLIENT_FLASH, jar, ENV, {
      kind: "error",
      message: "Parent.",
      path: "/selling/consignments",
    });
    writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "Child.", path: PATH });
    expect(readFlash(CLIENT_FLASH, jar, ENV, PATH)?.message).toBe("Child.");
  });

  it("ignores a cookie with a tampered value", () => {
    const { jar, stored } = fakeJar();
    stored.push({
      name: CLIENT_FLASH.cookie,
      value: "v1.e30.AAAA",
      path: PATH,
      maxAge: 60,
      secure: true,
    });
    expect(readFlash(CLIENT_FLASH, jar, ENV, PATH)).toBeNull();
  });

  it("ignores an expired message", () => {
    const { jar } = fakeJar();
    writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "Old.", path: PATH });
    expect(readFlash(CLIENT_FLASH, jar, { ...ENV, nowMs: ENV.nowMs + 61_000 }, PATH)).toBeNull();
  });

  it("refuses to store for a path outside the audience's pages", () => {
    const { jar, stored } = fakeJar();
    for (const path of [
      "/",
      "/login",
      "/selling/../x",
      "/selling/a?b=1",
      "/sellingx",
      "/admin/x",
    ]) {
      expect(writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "No.", path })).toBe(
        false,
      );
    }
    expect(stored).toHaveLength(0);
  });

  it("stores nothing for an empty message", () => {
    const { jar, stored } = fakeJar();
    expect(writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: " ", path: PATH })).toBe(
      false,
    );
    expect(stored).toHaveLength(0);
  });

  it("clears only a path the audience owns", () => {
    const { jar } = fakeJar();
    expect(clearFlash(CLIENT_FLASH, jar, ENV, "/login")).toBe(false);
    expect(clearFlash(CLIENT_FLASH, jar, ENV, PATH)).toBe(true);
  });
});

describe("staff and client messages stay apart", () => {
  it("uses a different cookie and key context for each audience", () => {
    expect(ADMIN_FLASH.cookie).not.toBe(CLIENT_FLASH.cookie);
    expect(ADMIN_FLASH.keyContext).not.toBe(CLIENT_FLASH.keyContext);
    expect(CLIENT_FLASH.keyContext).toBe("lax-bid:client-flash:v1");
  });

  it("a client message is not readable as a staff one and each owns its pages", () => {
    const { jar } = fakeJar();
    writeFlash(CLIENT_FLASH, jar, ENV, { kind: "error", message: "Mine.", path: PATH });
    expect(readFlash(ADMIN_FLASH, jar, ENV, PATH)).toBeNull();
    expect(ADMIN_FLASH.isFlashablePath("/admin/clients")).toBe(true);
    expect(ADMIN_FLASH.isFlashablePath(PATH)).toBe(false);
    expect(CLIENT_FLASH.isFlashablePath("/admin/clients")).toBe(false);
  });
});

describe("pathUnder", () => {
  it("accepts the root and clean paths below it, and rejects everything else", () => {
    expect(pathUnder("/admin", "/admin")).toBe(true);
    expect(pathUnder("/admin", "/admin/saleroom/abc%20d")).toBe(true);
    expect(pathUnder("/admin", "/admin/./x")).toBe(false);
    expect(pathUnder("/admin", "/admin/x y")).toBe(false);
    expect(pathUnder("/admin", `/admin/${"a".repeat(400)}`)).toBe(false);
    expect(pathUnder("/admin", "/administrator")).toBe(false);
  });
});
