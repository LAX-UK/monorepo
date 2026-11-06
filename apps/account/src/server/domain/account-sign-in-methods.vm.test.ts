import { describe, expect, it } from "vitest";
import {
  ONLY_METHOD_REASON,
  buildRemoveConfirm,
  buildSignInMethodsSection,
  isSignInMethodRejection,
  signInMethodRejectionMessage,
} from "./account-sign-in-methods.vm";

const google = { provider: "google", linkedAt: "2026-10-01T09:00:00.000Z" } as const;
const apple = { provider: "apple", linkedAt: "2026-10-05T09:00:00.000Z" } as const;
const ok = (hasPassword: boolean, social: (typeof google | typeof apple)[]) =>
  ({ status: "ok", value: { hasPassword, social } }) as const;

describe("buildSignInMethodsSection", () => {
  it("shows a password-only account with no social rows", () => {
    const vm = buildSignInMethodsSection(ok(true, []), "ada@example.com");
    expect(vm).toMatchObject({ status: "list", hint: null });
    if (vm.status !== "list") throw new Error("expected list");
    expect(vm.rows).toHaveLength(1);
    expect(vm.rows[0]).toMatchObject({ kind: "password", status: "Set", actionLabel: "Change" });
  });

  it("offers to add a password on a social-only account, and blocks removing the only method", () => {
    const vm = buildSignInMethodsSection(ok(false, [google]), "ada@example.com");
    if (vm.status !== "list") throw new Error("expected list");
    expect(vm.rows[0]).toMatchObject({
      kind: "password",
      status: "Not set",
      actionLabel: "Add a password",
      actionHref: "#password",
    });
    expect(vm.rows[1]).toMatchObject({
      kind: "social",
      title: "Google",
      blockedReason: ONLY_METHOD_REASON,
    });
    expect(vm.hint).toContain("Add a password");
  });

  it("shows the email in full and dates the link", () => {
    const vm = buildSignInMethodsSection(ok(true, [google]), "ada@example.com");
    if (vm.status !== "list") throw new Error("expected list");
    const row = vm.rows[1];
    expect(row?.kind === "social" && row.detail).toBe("ada@example.com · Linked Thu 1 Oct 2026");
  });

  it("allows removing either provider when there are two, and when a password is set", () => {
    for (const methods of [ok(false, [google, apple]), ok(true, [google])]) {
      const vm = buildSignInMethodsSection(methods, "ada@example.com");
      if (vm.status !== "list") throw new Error("expected list");
      for (const row of vm.rows) {
        if (row.kind === "social") expect(row.blockedReason).toBeNull();
      }
      expect(vm.hint).toBeNull();
    }
  });

  it("tells a sign-in that has ended apart from an issuer that did not answer", () => {
    expect(buildSignInMethodsSection({ status: "reauth_required" }, null)).toEqual({
      status: "reauth_required",
    });
    expect(buildSignInMethodsSection({ status: "unavailable" }, null)).toEqual({
      status: "unavailable",
    });
    expect(buildSignInMethodsSection(null, null)).toEqual({ status: "unavailable" });
  });
});

describe("buildRemoveConfirm", () => {
  it("names the provider and what still works, and warns about other devices and the email", () => {
    const withPassword = buildRemoveConfirm("google", []);
    expect(withPassword.title).toBe("Remove Google sign-in?");
    expect(withPassword.confirmLabel).toBe("Remove Google");
    expect(withPassword.body).toContain("email and password");
    expect(withPassword.body).toContain("Every other device will be signed out");
    expect(withPassword.body).toContain("sign in again");
    expect(buildRemoveConfirm("google", ["Apple"]).body).toContain("sign in with Apple");
  });
});

describe("refusal copy", () => {
  it("explains the last-method refusal and recognises only sign-in method reasons", () => {
    expect(signInMethodRejectionMessage("last_sign_in_method")).toBe(ONLY_METHOD_REASON);
    expect(isSignInMethodRejection("not_linked")).toBe(true);
    expect(isSignInMethodRejection("invalid_phone")).toBe(false);
  });
});
