import { describe, expect, it } from "vitest";
import { floatingInput, hostedButton, passwordField } from "./html.js";
import { HOSTED_AUTH_RUNTIME_SCRIPT } from "./runtime.js";
import { HOSTED_AUTH_STYLES } from "./styles.js";

describe("hosted auth visual contract", () => {
  it("locks Bid-equivalent shell geometry and underline fields", () => {
    expect(HOSTED_AUTH_STYLES).toContain("--auth-column: 528px");
    expect(HOSTED_AUTH_STYLES).toContain("--control-min: 2.75rem");
    expect(HOSTED_AUTH_STYLES).toContain("--label-tracking: 0.08em");
    expect(HOSTED_AUTH_STYLES).toContain("gap: 3rem");
    expect(HOSTED_AUTH_STYLES).toContain("gap: 2.5rem");
    expect(HOSTED_AUTH_STYLES).toContain("border-bottom: 1px solid var(--color-input-border)");
    expect(HOSTED_AUTH_STYLES).toContain("background: transparent");
    expect(HOSTED_AUTH_STYLES).toContain(
      "color-mix(in srgb, var(--color-border) 25%, transparent)",
    );
    expect(HOSTED_AUTH_STYLES).not.toContain("input:not([type=");
    expect(HOSTED_AUTH_STYLES).not.toContain("button,");
    expect(HOSTED_AUTH_STYLES).not.toContain("button {");
  });

  it("floats labels with sibling selectors and keeps autofill unboxed", () => {
    expect(HOSTED_AUTH_STYLES).toContain(".field-input:focus + .field-label");
    expect(HOSTED_AUTH_STYLES).toContain(".field-input:not(:placeholder-shown) + .field-label");
    expect(HOSTED_AUTH_STYLES).toContain(".field-input:-webkit-autofill + .field-label");
    expect(HOSTED_AUTH_STYLES).toContain(".field-input:autofill + .field-label");
    expect(HOSTED_AUTH_STYLES).toContain("transition: background-color 99999s ease-out");
    expect(HOSTED_AUTH_STYLES).not.toContain(
      ".field-control:has(.field-input:not(:placeholder-shown)",
    );
    expect(HOSTED_AUTH_STYLES).not.toContain(".field-control:has(.field-input:focus");
  });

  it("keeps password reveal independent from full-width CTAs", () => {
    expect(HOSTED_AUTH_STYLES).toContain(".btn-reveal");
    expect(HOSTED_AUTH_STYLES).toContain(".btn-primary");
    expect(HOSTED_AUTH_STYLES).toContain(".btn-secondary");
    expect(HOSTED_AUTH_STYLES).toContain(".btn-link");
    const reveal = passwordField({
      id: "password",
      label: "Password",
      autocomplete: "current-password",
    });
    expect(reveal).toContain('class="btn-reveal"');
    expect(reveal).toContain("data-password-toggle");
    expect(reveal).not.toContain("btn-primary");
    expect(reveal).toContain("aria-describedby");
    expect(reveal).toContain('aria-invalid="false"');
  });

  it("emits floating-label inputs instead of boxed labels wrapping native inputs", () => {
    const field = floatingInput({
      id: "email",
      label: "Email Address",
      type: "email",
      autocomplete: "username",
    });
    expect(field).toContain('class="field-control"');
    expect(field).toContain('class="field-label"');
    expect(field).toContain('class="field-input"');
    expect(field).toContain('placeholder=" "');
    expect(field).toContain("email-error");
    expect(field).toContain('data-field-kind="email"');
    expect(field).not.toContain('<label for="email">Email Address\n      <input');
    expect(
      passwordField({ id: "password", label: "Password", autocomplete: "current-password" }),
    ).toContain('data-field-kind="password"');
    expect(
      passwordField({ id: "password", label: "Password", autocomplete: "new-password" }),
    ).toContain('data-field-kind="new-password"');
  });

  it("scopes button kinds so utility actions cannot inherit the CTA", () => {
    expect(hostedButton({ label: "Sign In" })).toContain("btn btn-primary");
    expect(hostedButton({ label: "Change", type: "button", kind: "link" })).toContain(
      "btn btn-link",
    );
    expect(
      hostedButton({
        label: "Continue",
        extraAttrs: { "data-x": '"><script>alert(1)</script>' },
      }),
    ).toContain('data-x="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(floatingInput({ id: 'e"x', label: "<hi>" }).includes("<hi>")).toBe(false);
  });

  it("keeps generic server messages and fail-closed continuation in the runtime", () => {
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("Invalid email or password.");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("Unable to create your account. Try again later.");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("allowedRedirectOrigins");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("authorizeResumePath");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("productHintLoginUrl");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("restartUrl");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("ensureTurnstile");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("onTokenChange");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).not.toContain('params.get("callbackURL")');
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).not.toContain("eval(");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).not.toContain("input.id.indexOf");
  });
});
