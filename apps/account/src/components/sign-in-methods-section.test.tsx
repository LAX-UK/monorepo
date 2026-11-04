import type { SignInMethodsSectionVm } from "@/server/domain/account-sign-in-methods.vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SignInMethodsSection } from "./sign-in-methods-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  removeSignInMethodAction: vi.fn(),
}));

const password = (isSet: boolean) =>
  ({
    kind: "password",
    title: "Password",
    isSet,
    status: isSet ? "Set" : "Not set",
    detail: isSet
      ? "Sign in with your email and password."
      : "Add one to sign in with your email as well.",
    actionLabel: isSet ? "Change" : "Add a password",
    actionHref: "#password",
  }) as const;
const google = (blockedReason: string | null) =>
  ({
    kind: "social",
    provider: "google",
    title: "Google",
    detail: "ada@example.com · Linked 1 Oct 2026",
    blockedReason,
  }) as const;

const render = (section: SignInMethodsSectionVm) =>
  renderToStaticMarkup(
    <SignInMethodsSection
      section={section}
      pagePath="/account/security"
      reauthHref="/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth"
    />,
  );

describe("SignInMethodsSection", () => {
  it("shows a password-only account without any Remove button", () => {
    const html = render({ status: "list", rows: [password(true)], hint: null });
    expect(html).toContain('id="sign-in-methods"');
    expect(html).toContain("Set");
    expect(html).toContain(">Change<");
    expect(html).not.toContain("Remove");
  });

  it("offers Remove for a linked provider when another method remains", () => {
    const html = render({ status: "list", rows: [password(true), google(null)], hint: null });
    expect(html).toContain('aria-label="Remove Google sign-in"');
    expect(html).toContain("ada@example.com");
    expect(html).not.toMatch(/aria-label="Remove Google sign-in"[^>]*disabled/);
  });

  it("disables Remove on the only method and says why next to it", () => {
    const reason =
      "This is the only way you can sign in. Add a password first, then you can remove it.";
    const html = render({
      status: "list",
      rows: [password(false), google(reason)],
      hint: "Add a password so you can still get in.",
    });
    expect(html).toContain("Not set");
    expect(html).toContain('href="#password"');
    expect(html).toContain("Add a password");
    expect(html).toMatch(
      /<button[^>]*aria-describedby="[^"]+"[^>]*disabled|<button[^>]*disabled[^>]*aria-describedby/,
    );
    expect(html).toContain(reason);
  });

  it("asks to sign in again when the issuer no longer knows this sign-in", () => {
    const html = render({ status: "reauth_required" });
    expect(html).toContain("Sign in again to see your sign-in methods");
    expect(html).not.toContain("Remove");
  });

  it("reports an unavailable list as a temporary problem with a retry, never as empty", () => {
    const html = render({ status: "unavailable" });
    expect(html).toContain("We can&#x27;t show your sign-in methods right now");
    expect(html).toContain('href="/account/security"');
  });
});
