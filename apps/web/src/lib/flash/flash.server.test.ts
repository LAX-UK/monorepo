import { beforeEach, describe, expect, it, vi } from "vitest";

type Stored = { name: string; value: string; path: string };

const jar = vi.hoisted(() => ({ stored: [] as Stored[] }));
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: (name: string) => jar.stored.filter((c) => c.name === name),
    set: (
      name: string,
      value: string,
      options: { path: string; maxAge: number; httpOnly: boolean; sameSite: string },
    ) => {
      jar.stored = jar.stored.filter((c) => !(c.name === name && c.path === options.path));
      if (options.maxAge > 0) jar.stored.push({ name, value, path: options.path });
    },
  }),
}));

const { dropClientFlash, readClientFlashForPath, redirectWithClientFlash } = await import(
  "./client-flash.server"
);

const PATH = "/selling/consignments/abc";

describe("client flash on the server", () => {
  beforeEach(() => {
    jar.stored = [];
    redirectMock.mockClear();
    vi.stubEnv("BID_BFF_SESSION_ENCRYPTION_KEY", Buffer.alloc(32, 5).toString("base64url"));
  });

  it("redirects to the clean path and keeps the message out of the URL", async () => {
    await expect(redirectWithClientFlash(PATH, "error", "Secret reason <b>x</b>")).rejects.toThrow(
      `NEXT_REDIRECT:${PATH}`,
    );

    const target = redirectMock.mock.calls[0]?.[0] as string;
    expect(target).toBe(PATH);
    expect(target).not.toContain("?");
    expect(target).not.toContain("Secret");
  });

  it("shows the message once on its page, then nothing after it is dropped", async () => {
    await redirectWithClientFlash(PATH, "error", "The submission is locked.").catch(
      () => undefined,
    );

    expect(await readClientFlashForPath(PATH)).toEqual({
      kind: "error",
      message: "The submission is locked.",
    });
    expect(await readClientFlashForPath("/selling/consignments/other")).toBeNull();

    expect(await dropClientFlash(PATH)).toBe(true);
    expect(await readClientFlashForPath(PATH)).toBeNull();
  });

  it("will not drop a path outside the seller pages", async () => {
    expect(await dropClientFlash("/login")).toBe(false);
  });

  it("does not trust a cookie signed with a different secret", async () => {
    await redirectWithClientFlash(PATH, "error", "The submission is locked.").catch(
      () => undefined,
    );
    vi.stubEnv("BID_BFF_SESSION_ENCRYPTION_KEY", Buffer.alloc(32, 6).toString("base64url"));

    expect(await readClientFlashForPath(PATH)).toBeNull();
  });
});
