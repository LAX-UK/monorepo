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
  it("guarded marketing pages import redirectIfAuthenticated or verify-pending guard", () => {
    expect(read("app/(marketing)/login/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/register/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/forgot-password/page.tsx")).toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/register/verify-pending/page.tsx")).toContain(
      "redirectIfVerifyPendingNotNeeded",
    );
  });

  it("token-bound pages do not import redirectIfAuthenticated", () => {
    expect(read("app/(marketing)/reset-password/page.tsx")).not.toContain(
      "redirectIfAuthenticated",
    );
    expect(read("app/(marketing)/verify-email/page.tsx")).not.toContain("redirectIfAuthenticated");
    expect(read("app/(marketing)/unsubscribe/page.tsx")).not.toContain("redirectIfAuthenticated");
  });
});
