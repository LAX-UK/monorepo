import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));

const { GET } = await import("./route");

function landing(returnTo?: string): string {
  const url = new URL("https://art.example/account/post-sign-in");
  if (returnTo !== undefined) url.searchParams.set("returnTo", returnTo);
  try {
    GET(new Request(url));
  } catch (error) {
    return (error as Error).message.replace(/^redirect:/, "");
  }
  throw new Error("expected a redirect");
}

describe("post-sign-in landing", () => {
  it("returns to the page that started sign-in, keeping its query", () => {
    expect(landing("/artworks/tidal-forms?enquire=1")).toBe("/artworks/tidal-forms?enquire=1");
  });

  it("falls back to the account home for missing, external, or looping targets", () => {
    expect(landing()).toBe("/account");
    expect(landing("https://evil.example/")).toBe("/account");
    expect(landing("//evil.example/")).toBe("/account");
    expect(landing("/account/post-sign-in?returnTo=%2F")).toBe("/account");
  });
});
