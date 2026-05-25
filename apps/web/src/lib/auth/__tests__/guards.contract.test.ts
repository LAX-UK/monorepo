import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), "utf8");
}

describe("auth guard contract (source)", () => {
  it("requireAuthenticatedUser enforces verified email with verify-pending redirect", () => {
    const src = read("lib/auth/guards.server.ts");
    expect(src).toContain("emailVerified !== true");
    expect(src).toContain("/register/verify-pending");
  });

  it("guarded task auth pages import redirectIfAuthenticated or verify-pending guard", () => {
    expect(read("app/(task)/login/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(task)/register/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(task)/forgot-password/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(task)/register/verify-pending/page.tsx")).toContain(
      "redirectIfVerifyPendingNotNeeded",
    );
  });

  it("token-bound pages do not import redirectIfAuthenticated", () => {
    expect(read("app/(task)/reset-password/page.tsx")).not.toContain("redirectIfAuthenticated");
    expect(read("app/(task)/verify-email/page.tsx")).not.toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/unsubscribe/page.tsx")).not.toContain("redirectIfAuthenticated");
  });
});
