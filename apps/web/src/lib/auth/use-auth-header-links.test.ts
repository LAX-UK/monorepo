import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { resolveHeaderAuthNext } from "@/lib/auth/use-auth-header-links";
import { describe, expect, it } from "vitest";

describe("resolveHeaderAuthNext", () => {
  it("returns pathname with search when safe", () => {
    expect(resolveHeaderAuthNext("/lot/foo/1", "view=grid")).toBe("/lot/foo/1?view=grid");
  });

  it("returns null on auth routes", () => {
    expect(resolveHeaderAuthNext("/login", "")).toBeNull();
    expect(resolveHeaderAuthNext("/register", "step=1")).toBeNull();
  });
});

describe("buildAuthHref integration", () => {
  it("preserves safe next for lot pages", () => {
    const next = resolveHeaderAuthNext("/lot/foo/1", "");
    expect(next).toBe("/lot/foo/1");
    expect(isSafeNextPath(next)).toBe(true);
    expect(buildAuthHref("/login", { next })).toBe("/login?next=%2Flot%2Ffoo%2F1");
  });
});
