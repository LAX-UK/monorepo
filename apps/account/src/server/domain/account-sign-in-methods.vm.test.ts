import type { AccountSignInMethodsResponse } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import {
  ONLY_METHOD_REASON,
  buildRemoveConfirm,
  buildSignInMethodFlash,
  buildSignInMethodsSection,
  isSignInMethodRejection,
  signInMethodRejectionMessage,
} from "./account-sign-in-methods.vm";

type Social = AccountSignInMethodsResponse["social"][number];
const google: Social = {
  provider: "google",
  linkedAt: "2026-10-01T09:00:00.000Z",
  providerEmail: "ada.lovelace@gmail.com",
  hidden: false,
};
const apple: Social = {
  provider: "apple",
  linkedAt: "2026-10-05T09:00:00.000Z",
  providerEmail: null,
  hidden: true,
};
const passkey = {
  id: "pk-1",
  name: "iCloud Keychain",
  synced: true,
  kind: "platform",
  createdAt: "2026-11-03T09:00:00.000Z",
  lastUsedAt: null,
} as const;
const ok = (
  hasPassword: boolean,
  social: Social[],
  extra: {
    available?: Partial<AccountSignInMethodsResponse["available"]>;
    passkeys?: AccountSignInMethodsResponse["passkeys"];
  } = {},
) =>
  ({
    status: "ok",
    value: {
      hasPassword,
      social,
      passkeys: extra.passkeys ?? [],
      available: { google: true, apple: true, passkey: false, ...extra.available },
    },
  }) as const;

const rowsOf = (result: ReturnType<typeof ok>) => {
  const vm = buildSignInMethodsSection(result);
  if (vm.status !== "list") throw new Error("expected list");
  return vm;
};

describe("buildSignInMethodsSection", () => {
  it("lists every method in a fixed order: password, Google, Apple", () => {
    expect(rowsOf(ok(true, [apple, google])).rows.map((row) => `${row.kind}:${row.title}`)).toEqual(
      ["password:Password", "social:Google", "social:Apple"],
    );
    expect(rowsOf(ok(true, [])).rows.map((row) => `${row.kind}:${row.title}`)).toEqual([
      "password:Password",
      "link:Google",
      "link:Apple",
    ]);
  });

  it("says nothing about a lone method for a password-only account", () => {
    expect(rowsOf(ok(true, [])).hint).toBeNull();
  });

  it("offers a Link row for a provider that is not linked, with its busy label", () => {
    const vm = rowsOf(ok(true, [google]));
    expect(vm.rows[2]).toEqual({
      kind: "link",
      provider: "apple",
      title: "Apple",
      detail: "Not linked.",
      detailMore: "Sign in with your Apple Account.",
      actionLabel: "Link Apple",
      busyLabel: "Opening Apple…",
    });
  });

  it("has no row for a provider the environment does not offer, and none for staff", () => {
    const rows = rowsOf(ok(true, [], { available: { apple: false } })).rows;
    expect(rows.map((row) => row.title)).toEqual(["Password", "Google"]);
    const staff = rowsOf(ok(true, [], { available: { google: false, apple: false } })).rows;
    expect(staff.map((row) => row.kind)).toEqual(["password"]);
  });

  it("still shows a linked provider the environment no longer offers, so it can be removed", () => {
    const rows = rowsOf(ok(true, [google], { available: { google: false } })).rows;
    expect(rows.map((row) => `${row.kind}:${row.title}`)).toContain("social:Google");
  });

  it("shows the address the provider gave and when it was linked", () => {
    const row = rowsOf(ok(true, [google])).rows[1];
    expect(row?.kind === "social" && row.detail).toBe(
      "ada.lovelace@gmail.com · Linked Thu 1 Oct 2026",
    );
  });

  it("says the address is hidden, and never shows a relay address", () => {
    const relay: Social = { ...apple, providerEmail: "abc123@privaterelay.appleid.com" };
    const row = rowsOf(ok(true, [relay])).rows.find((r) => r.title === "Apple");
    expect(row?.kind === "social" && row.detail).toBe(
      "Address hidden by Apple · Linked Mon 5 Oct 2026",
    );
    expect(JSON.stringify(row)).not.toContain("privaterelay");
  });

  it("shows only the date when the provider reported no address", () => {
    const quiet: Social = { ...google, providerEmail: null };
    const row = rowsOf(ok(true, [quiet])).rows[1];
    expect(row?.kind === "social" && row.detail).toBe("Linked Thu 1 Oct 2026");
  });

  it("offers to add a password on a social-only account, and blocks removing the only method", () => {
    const vm = rowsOf(ok(false, [google]));
    expect(vm.rows[0]).toMatchObject({
      kind: "password",
      status: "Not set",
      actionLabel: "Add a password",
    });
    expect(vm.rows[1]).toMatchObject({
      kind: "social",
      title: "Google",
      blockedReason: ONLY_METHOD_REASON,
    });
    expect(vm.hint).toContain("Add a password");
  });

  it("mentions a passkey in the refusal only when passkeys can be added", () => {
    const vm = rowsOf(ok(false, [google], { available: { passkey: true } }));
    const row = vm.rows[1];
    expect(row?.kind === "social" && row.blockedReason).toContain("Add a passkey or a password");
  });

  it("counts passkeys, so Google can go when a passkey remains", () => {
    const vm = rowsOf(ok(false, [google], { passkeys: [passkey] }));
    const row = vm.rows.find((r) => r.kind === "social");
    expect(row?.kind === "social" && row.blockedReason).toBeNull();
    expect(vm.hint).toBeNull();
  });

  it("allows removing either provider when there are two, and when a password is set", () => {
    for (const methods of [ok(false, [google, apple]), ok(true, [google])]) {
      const vm = rowsOf(methods);
      for (const row of vm.rows) {
        if (row.kind === "social") expect(row.blockedReason).toBeNull();
      }
      expect(vm.hint).toBeNull();
    }
  });

  it("tells a sign-in that has ended apart from an issuer that did not answer", () => {
    expect(buildSignInMethodsSection({ status: "reauth_required" })).toEqual({
      status: "reauth_required",
    });
    expect(buildSignInMethodsSection({ status: "unavailable" })).toEqual({
      status: "unavailable",
    });
    expect(buildSignInMethodsSection(null)).toEqual({ status: "unavailable" });
  });
});

describe("buildSignInMethodFlash", () => {
  it("says a linked provider worked, in the success tone", () => {
    expect(buildSignInMethodFlash("google_linked")).toEqual({
      tone: "success",
      title: "Google is linked",
      body: "You can now sign in with it.",
      reauth: false,
    });
    expect(buildSignInMethodFlash("apple_linked")?.title).toBe("Apple is linked");
  });

  it("has a notice for every word the issuer can send back, and a fresh sign-in only for one", () => {
    const words = [
      "google_linked",
      "apple_linked",
      "passkey_added",
      "cancelled",
      "already_linked_elsewhere",
      "provider_unavailable",
      "expired",
      "reauth_required",
      "rate_limited",
      "passkey_limit",
      "staff_not_allowed",
    ];
    for (const word of words) {
      const flash = buildSignInMethodFlash(word);
      expect(flash, word).not.toBeNull();
      expect(flash?.title.length).toBeGreaterThan(5);
      expect(flash?.reauth).toBe(word === "reauth_required");
    }
  });

  it("says nothing changed for each way linking can fail", () => {
    for (const word of ["cancelled", "provider_unavailable", "expired"]) {
      expect(buildSignInMethodFlash(word)?.body).toContain("Nothing changed");
    }
  });

  it("shows nothing for a missing, unknown or edited word, and never echoes it", () => {
    for (const word of [
      undefined,
      "",
      "google",
      "<script>",
      "google_linked&x=1",
      "GOOGLE_LINKED",
    ]) {
      expect(buildSignInMethodFlash(word)).toBeNull();
    }
    expect(buildSignInMethodFlash(["google_linked", "x"])?.title).toBe("Google is linked");
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

  it("has a sentence for every refusal the issuer can return", () => {
    for (const reason of [
      "last_sign_in_method",
      "not_linked",
      "rate_limited",
      "passkey_limit",
      "not_available",
      "staff_not_allowed",
      "already_linked",
    ] as const) {
      expect(isSignInMethodRejection(reason)).toBe(true);
      expect(signInMethodRejectionMessage(reason).length).toBeGreaterThan(10);
    }
    expect(signInMethodRejectionMessage("staff_not_allowed")).toBe(
      "Staff accounts can't sign in with Google or Apple. Add a passkey instead.",
    );
  });
});
