import {
  type SignInMethodFlashVm,
  type SignInMethodsSectionVm,
  buildSignInMethodFlash,
} from "@/server/domain/account-sign-in-methods.vm";
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
  }) as const;
const google = (blockedReason: string | null) =>
  ({
    kind: "social",
    provider: "google",
    title: "Google",
    address: "ada@example.com",
    linkedOn: "Linked 1 Oct 2026",
    blockedReason,
  }) as const;

const render = (section: SignInMethodsSectionVm, flash: SignInMethodFlashVm | null = null) =>
  renderToStaticMarkup(
    <SignInMethodsSection
      section={section}
      flash={flash}
      pagePath="/account/security"
      reauthHref="/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth"
      passwordPanel={<form data-testid="password-form" />}
      twoStep={{ title: "Two-step verification", subtitle: "On", href: "https://auth.example/2fa" }}
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

  it("keeps the linked date whole on a line, apart from the address", () => {
    const html = render({ status: "list", rows: [password(true), google(null)], hint: null });
    expect(html).toMatch(/<span class="whitespace-nowrap">Linked 1 Oct 2026<\/span>/);
  });

  it("disables Remove on the only method and says why next to it", () => {
    const reason =
      "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.";
    const html = render({
      status: "list",
      rows: [password(false), google(reason)],
      hint: "Add a password so you can still get in.",
    });
    expect(html).toContain("Not set");
    expect(html).toContain("Add a password");
    expect(html).toMatch(
      /<button[^>]*aria-describedby="[^"]+"[^>]*disabled|<button[^>]*disabled[^>]*aria-describedby/,
    );
    expect(html).toContain(reason);
  });

  it("is one section: Password opens its form in place, then Two-step verification", () => {
    const html = render({ status: "list", rows: [password(true), google(null)], hint: null });
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html).toContain("How you sign in");
    expect(html).not.toContain("Sign-in methods");
    expect(html).not.toContain('id="password"');
    expect(html).not.toContain("Signing in");
    expect(html).toMatch(
      /<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"[^>]*>Change</,
    );
    const order = ["Password", "Google", "Two-step verification"].map((t) => html.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html.indexOf("password-form")).toBeLessThan(html.indexOf("Google"));
    expect(html).toContain('href="https://auth.example/2fa"');
  });

  it("asks to sign in again when the issuer no longer knows this sign-in", () => {
    const html = render({ status: "reauth_required" });
    expect(html).toContain("Sign in again to see your sign-in methods");
    expect(html).not.toContain("Remove");
    expect(html).toContain("password-form");
    expect(html).toContain("Two-step verification");
  });

  it("reports an unavailable list as a temporary problem with a retry, never as empty", () => {
    const html = render({ status: "unavailable" });
    expect(html).toContain("We can&#x27;t show your sign-in methods right now");
    expect(html).toContain('href="/account/security"');
  });

  it("puts what the issuer sent the person back with at the top of the section, above the list", () => {
    const flash = buildSignInMethodFlash("google_linked", undefined, {
      linked: ["google"],
      passkeys: 0,
    });
    const html = render(
      { status: "list", rows: [password(true), google(null)], hint: null },
      flash,
    );
    expect(html).toContain("Google is linked");
    expect(html.indexOf("Google is linked")).toBeLessThan(html.indexOf("Password"));
  });

  it("shows it even when the list cannot be read, so a result is never lost", () => {
    const html = render(
      { status: "unavailable" },
      buildSignInMethodFlash("cancelled", "google", null),
    );
    expect(html).toContain("Linking Google was cancelled");
    expect(html).toContain("We can&#x27;t show your sign-in methods right now");
  });

  it("shows no notice when nothing was sent back", () => {
    expect(render({ status: "list", rows: [password(true)], hint: null })).not.toContain(
      "data-sign-in-method-flash",
    );
  });
});
