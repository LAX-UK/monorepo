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

  it("hosted task auth pages use ensureHostedAuthRedirect (redirectIfAuthenticated inside BFF helper)", () => {
    expect(read("app/(task)/login/page.tsx")).toContain("ensureHostedAuthRedirect");
    expect(read("app/(task)/register/page.tsx")).toContain("ensureHostedAuthRedirect");
    expect(read("app/(task)/forgot-password/page.tsx")).toContain("ensureHostedAuthRedirect");
    expect(read("lib/bff/hosted-auth-page.server.ts")).toContain("redirectIfAuthenticated");
    expect(read("app/(task)/register/verify-pending/page.tsx")).toContain(
      "buildBidIssuerHostedUrl",
    );
  });

  it("token-bound pages do not import redirectIfAuthenticated", () => {
    expect(read("app/(task)/reset-password/page.tsx")).not.toContain("redirectIfAuthenticated");
    expect(read("app/(task)/verify-email/page.tsx")).not.toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/unsubscribe/page.tsx")).not.toContain("redirectIfAuthenticated");
  });
});
