import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmailChangeConfirm } from "./email-change-confirm.client";
import { EmailChangeEditor } from "./email-change-editor.client";
import { PhoneEditor } from "./phone-editor.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  cancelEmailChangeAction: vi.fn(),
  confirmEmailChangeAction: vi.fn(),
  sendPhoneCodeAction: vi.fn(),
  startEmailChangeAction: vi.fn(),
  verifyPhoneAction: vi.fn(),
}));

describe("EmailChangeEditor", () => {
  it("offers Change email when nothing is pending", () => {
    const html = renderToStaticMarkup(
      <EmailChangeEditor pendingEmailMasked={null} returnTo="/account/profile" />,
    );
    expect(html).toContain("Change email");
    expect(html).not.toContain("Waiting for you to confirm");
    expect(html).not.toContain("Cancel the change");
  });

  it("says which address a pending change is for and offers to cancel or start again", () => {
    const html = renderToStaticMarkup(
      <EmailChangeEditor pendingEmailMasked="n***@example.com" returnTo="/account/profile" />,
    );
    expect(html).toContain("Waiting for you to confirm the change to");
    expect(html).toContain("n***@example.com");
    expect(html).toContain("Cancel the change");
    expect(html).toContain("Use a different address");
  });
});

describe("PhoneEditor", () => {
  const render = (phone: string | null, phoneVerified: boolean) =>
    renderToStaticMarkup(
      <PhoneEditor phone={phone} phoneVerified={phoneVerified} returnTo="/account/profile" />,
    );

  it.each([
    [null, false, "Add phone number"],
    ["+447700900123", false, "Verify phone number"],
    ["+447700900123", true, "Change phone number"],
  ] as const)("offers the right action for %s verified=%s", (phone, verified, label) => {
    expect(render(phone, verified)).toContain(label);
  });

  it("does not show the number or code fields until the person starts", () => {
    const html = render(null, false);
    expect(html).not.toContain("<input");
  });
});

describe("EmailChangeConfirm", () => {
  it("explains the two-inbox rule and offers one confirm button", () => {
    const html = renderToStaticMarkup(
      <EmailChangeConfirm token="signed.token" signInHref="/api/auth/login" />,
    );
    expect(html).toContain("Confirm your email change");
    expect(html).toContain("both your current and your new");
    expect(html).toMatch(/<button[^>]*>(?:<span[^>]*>)*Confirm email change/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:<span[^>]*>)*Confirm email change/);
  });

  it("cannot be confirmed when the link was cut short", () => {
    const html = renderToStaticMarkup(<EmailChangeConfirm token="" signInHref="/api/auth/login" />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:<span[^>]*>)*Confirm email change/);
  });
});
