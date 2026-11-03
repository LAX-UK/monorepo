import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form.client";
import { PasswordSection } from "./password-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  changePasswordAction: vi.fn(),
}));

const FORGOT = "https://auth.example/forgot-password?client_id=lax-account-web";

describe("ChangePasswordForm", () => {
  const render = (mode: "change" | "create") =>
    renderToStaticMarkup(
      <ChangePasswordForm mode={mode} forgotPasswordHref={FORGOT} returnTo="/account/security" />,
    );

  it("asks for the current password, the new one and a confirmation, as password fields", () => {
    const html = render("change");
    expect(html).toContain("Current password");
    expect(html).toContain("New password");
    expect(html).toContain("Confirm new password");
    expect(html).toContain('autoComplete="current-password"');
    expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(html.match(/type="password"/g)).toHaveLength(3);
  });

  it("offers one show toggle, off by default", () => {
    const html = render("change");
    expect(html).toContain("Show passwords");
    expect(html).toContain('aria-pressed="false"');
  });

  it("shows the hints before anything is typed, each marked as not yet met", () => {
    const html = render("change");
    expect(html).toContain("At least 12 characters");
    expect(html).toContain("Different from your current password");
    expect(html).toContain("Both new passwords match");
    expect(html).toContain("(not yet)");
  });

  it("keeps the forgotten-password link for people who do not know their current password", () => {
    const html = render("change");
    expect(html).toContain("Forgot your password?");
    expect(html).toContain(`href="${FORGOT.replace(/&/g, "&amp;")}"`);
  });

  it("renders no error summary until a submit finds a mistake", () => {
    expect(render("change")).not.toContain("There is a problem");
  });

  it("adds a first password without a current-password field or a forgot link", () => {
    const html = render("create");
    expect(html).not.toContain("Current password");
    expect(html).not.toContain("Forgot your password?");
    expect(html).toContain("Add password");
    expect(html.match(/type="password"/g)).toHaveLength(2);
  });
});

describe("PasswordSection", () => {
  it("says what a change does to other devices", () => {
    const html = renderToStaticMarkup(
      <PasswordSection mode="change" forgotPasswordHref={FORGOT} pagePath="/account/security" />,
    );
    expect(html).toContain("signs you out on every other device");
    expect(html).toContain("Update password");
  });
});
