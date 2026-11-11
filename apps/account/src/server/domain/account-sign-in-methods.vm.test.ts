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
    expect(row).toMatchObject({
      address: "ada.lovelace@gmail.com",
      linkedOn: "Linked Thu 1 Oct 2026",
    });
  });

  it("says the address is hidden, and never shows a relay address", () => {
    const relay: Social = { ...apple, providerEmail: "abc123@privaterelay.appleid.com" };
    const row = rowsOf(ok(true, [relay])).rows.find((r) => r.title === "Apple");
    expect(row).toMatchObject({
      address: "Address hidden by Apple",
      linkedOn: "Linked Mon 5 Oct 2026",
    });
    expect(JSON.stringify(row)).not.toContain("privaterelay");
  });

  it("shows only the date when the provider reported no address", () => {
    const quiet: Social = { ...google, providerEmail: null };
    const row = rowsOf(ok(true, [quiet])).rows[1];
    expect(row).toMatchObject({ address: null, linkedOn: "Linked Thu 1 Oct 2026" });
  });

  it("says add another way when a link is offered beside the only method, and drops the hint", () => {
    const vm = rowsOf(ok(false, [google]));
    expect(vm.rows[1]).toMatchObject({
      blockedReason:
        "This is the only way you can sign in. Add another way to sign in first, then you can remove it.",
    });
    expect(vm.hint).toBeNull();
  });

  it("says add a passkey or a password when nothing else is offered", () => {
    const vm = rowsOf(ok(false, [google, apple].slice(0, 1), { available: { apple: false } }));
    expect(vm.rows[1]).toMatchObject({ blockedReason: ONLY_METHOD_REASON });
  });

  it("offers to add a password on a social-only account, and blocks removing the only method", () => {
    const vm = rowsOf(ok(false, [google], { available: { apple: false } }));
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
  });

  it("keeps the hint for a lone passkey, where no row carries the reason", () => {
    const vm = rowsOf(ok(false, [], { passkeys: [passkey] }));
    expect(vm.hint).toContain("Add a password");
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
  const holding = { linked: ["google", "apple"], passkeys: 1 } as const;
  const nothing = { linked: [], passkeys: 0 } as const;

  it("says a linked provider worked, in the success tone, when the account has it", () => {
    expect(buildSignInMethodFlash("google_linked", undefined, holding)).toEqual({
      tone: "success",
      title: "Google is linked",
      body: "You can now sign in with it.",
      reauth: false,
    });
    expect(buildSignInMethodFlash("apple_linked", undefined, holding)?.title).toBe(
      "Apple is linked",
    );
  });

  it("shows no success the account does not bear out, or when the list is unknown", () => {
    expect(buildSignInMethodFlash("google_linked", undefined, nothing)).toBeNull();
    expect(
      buildSignInMethodFlash("apple_linked", undefined, { linked: ["google"], passkeys: 0 }),
    ).toBeNull();
    expect(buildSignInMethodFlash("passkey_added", undefined, nothing)).toBeNull();
    expect(buildSignInMethodFlash("google_linked", undefined, null)).toBeNull();
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
      const flash = buildSignInMethodFlash(word, undefined, holding);
      expect(flash, word).not.toBeNull();
      expect(flash?.title.length).toBeGreaterThan(5);
      expect(flash?.reauth).toBe(word === "reauth_required");
    }
  });

  it("says nothing changed for each way linking can fail", () => {
    for (const word of ["cancelled", "provider_unavailable", "expired"]) {
      expect(buildSignInMethodFlash(word, "google", nothing)?.body).toContain("Nothing changed");
    }
  });

  it("names the provider the issuer says the notice is about", () => {
    expect(buildSignInMethodFlash("cancelled", "google", nothing)?.title).toBe(
      "Linking Google was cancelled",
    );
    expect(buildSignInMethodFlash("reauth_required", "apple", nothing)?.title).toBe(
      "Sign in again to link Apple",
    );
    expect(buildSignInMethodFlash("expired", "google", nothing)?.body).toBe(
      "Nothing changed. Choose Link Google again to start over.",
    );
    const elsewhere = buildSignInMethodFlash("already_linked_elsewhere", "google", nothing);
    expect(elsewhere?.title).toBe("That Google account is already linked to another LAX Account");
    expect(elsewhere?.body).toBe(
      "Each Google account can sign in to one LAX Account. Sign in to the other account and remove Google there, or link a different Google account.",
    );
  });

  it("falls back to general wording for a missing or unknown provider, never echoing it", () => {
    expect(buildSignInMethodFlash("cancelled", undefined, nothing)?.title).toBe(
      "Linking was cancelled",
    );
    const odd = buildSignInMethodFlash("cancelled", "<script>", nothing);
    expect(odd?.title).toBe("Linking was cancelled");
    expect(JSON.stringify(odd)).not.toContain("script");
  });

  it("does not say an account is linked elsewhere when it is linked here", () => {
    expect(buildSignInMethodFlash("already_linked_elsewhere", "google", holding)).toBeNull();
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
      expect(buildSignInMethodFlash(word, undefined, holding)).toBeNull();
    }
    expect(buildSignInMethodFlash(["google_linked", "x"], undefined, holding)?.title).toBe(
      "Google is linked",
    );
  });
});

describe("buildRemoveConfirm", () => {
  it("names the provider and what still works, and warns about other devices and the email", () => {
    const withPassword = buildRemoveConfirm("google", "your password");
    expect(withPassword.title).toBe("Remove Google sign-in?");
    expect(withPassword.confirmLabel).toBe("Remove Google");
    expect(withPassword.body).toContain("sign in with your password");
    expect(withPassword.body).toContain("Every other device will be signed out");
    expect(withPassword.body).toContain("sign in again");
    expect(buildRemoveConfirm("google", "your password, your passkeys or Apple").body).toContain(
      "sign in with your password, your passkeys or Apple",
    );
  });

  it("falls back to the email and password when nothing is named", () => {
    expect(buildRemoveConfirm("google", null).body).toContain("email and password");
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

describe("passkey rows", () => {
  const NOW = new Date("2026-11-11T12:00:00.000Z");
  const keychain = { ...passkey, lastUsedAt: "2026-11-11T08:00:00.000Z" };
  const yubikey = {
    id: "pk-2",
    name: "YubiKey 5",
    synced: false,
    kind: "security_key",
    createdAt: "2026-10-21T09:00:00.000Z",
    lastUsedAt: "2026-11-02T09:00:00.000Z",
  } as const;
  const on = { available: { passkey: true } };
  const build = (result: ReturnType<typeof ok>) => {
    const vm = buildSignInMethodsSection(result, NOW);
    if (vm.status !== "list") throw new Error("expected list");
    return vm;
  };
  const passkeysRow = (result: ReturnType<typeof ok>) => {
    const row = build(result).rows.find((entry) => entry.kind === "passkeys");
    if (row?.kind !== "passkeys") throw new Error("expected a passkeys row");
    return row;
  };

  it("has no passkeys row at all when the environment does not offer passkeys", () => {
    const vm = build(ok(true, [google], { passkeys: [keychain] }));
    expect(vm.rows.map((row) => row.kind)).toEqual(["password", "social", "link"]);
  });

  it("puts the row between the password and the providers", () => {
    expect(build(ok(true, [google], on)).rows.map((row) => `${row.kind}:${row.title}`)).toEqual([
      "password:Password",
      "passkeys:Passkeys",
      "social:Google",
      "link:Apple",
    ]);
  });

  it("invites when there are none, in the design's words", () => {
    const row = passkeysRow(ok(true, [], on));
    expect(row).toMatchObject({ count: 0, items: [], addBlockedReason: null });
    expect(row.detail).toBe("Sign in with your face, fingerprint or screen lock.");
    expect(row.detailLong).toBe(
      "Sign in with your face, fingerprint or screen lock instead of your password. Safer, and nothing to remember.",
    );
    expect(passkeysRow(ok(false, [google], on)).detailLong).toBe(
      "Sign in with your face, fingerprint or screen lock. Safer, and nothing to remember.",
    );
  });

  it("says where each is kept and when it was added and last used, in the one date style", () => {
    const row = passkeysRow(ok(true, [], { ...on, passkeys: [keychain, yubikey] }));
    expect(row.count).toBe(2);
    expect(row.detailLong).toBe(
      "Sign in with your face, fingerprint or screen lock. No password to type.",
    );
    expect(row.items[0]).toMatchObject({
      name: "iCloud Keychain",
      hint: "Synced to your other devices",
      addedOn: "Tue 3 Nov 2026",
      lastUsed: "Last used today",
    });
    expect(row.items[1]).toMatchObject({
      name: "YubiKey 5",
      hint: "This security key only",
      addedOn: "Wed 21 Oct 2026",
      lastUsed: "Last used Mon 2 Nov 2026",
    });
  });

  it("says a device-bound passkey is for this device only, and one never used is not used yet", () => {
    const device = { ...passkey, synced: false, lastUsedAt: null };
    const [item] = passkeysRow(ok(true, [], { ...on, passkeys: [device] })).items;
    expect(item).toMatchObject({ hint: "This device only", lastUsed: "Not used yet" });
  });

  it("blocks Remove on the only way in, with the reason, and on no other", () => {
    const lone = passkeysRow(ok(false, [], { ...on, passkeys: [passkey] }));
    expect(lone.items[0]?.blockedReason).toBe(ONLY_METHOD_REASON);
    const withPassword = passkeysRow(ok(true, [], { ...on, passkeys: [passkey] }));
    expect(withPassword.items[0]?.blockedReason).toBeNull();
    const twoPasskeys = passkeysRow(ok(false, [], { ...on, passkeys: [keychain, yubikey] }));
    expect(twoPasskeys.items.map((item) => item.blockedReason)).toEqual([null, null]);
    const withGoogle = passkeysRow(ok(false, [google], { ...on, passkeys: [passkey] }));
    expect(withGoogle.items[0]?.blockedReason).toBeNull();
  });

  it("does not hint that the one method is a lone passkey when the row already says it", () => {
    expect(build(ok(false, [], { ...on, passkeys: [passkey] })).hint).toBeNull();
  });

  it("lists what still works in the confirmation, with the other passkeys", () => {
    const row = passkeysRow(ok(true, [google], { ...on, passkeys: [keychain, yubikey] }));
    const confirm = row.items[1]?.confirm;
    expect(confirm?.title).toBe('Remove "YubiKey 5"?');
    expect(confirm?.body).toContain(
      "You'll still be able to sign in with your password, your other passkey or Google.",
    );
    expect(confirm?.body).toContain("Every other device will be signed out");
    expect(confirm?.note).toBe(
      "The passkey stays saved on the device until you delete it there too.",
    );
    expect(confirm?.confirmLabel).toBe("Remove passkey");
  });

  it("disables Add at ten, with the reason", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ({ ...passkey, id: `pk-${index}` }));
    const row = passkeysRow(ok(true, [], { ...on, passkeys: ten }));
    expect(row.items).toHaveLength(10);
    expect(row.addBlockedReason).toBe(
      "You have 10 passkeys, the most an account can have. Remove one to add another.",
    );
    const nine = passkeysRow(ok(true, [], { ...on, passkeys: ten.slice(0, 9) }));
    expect(nine.addBlockedReason).toBeNull();
  });

  it("counts passkeys, flag on or off, when deciding the only way in is a provider", () => {
    const vm = build(ok(false, [google], { passkeys: [passkey] }));
    const social = vm.rows.find((row) => row.kind === "social");
    expect(social?.kind === "social" && social.blockedReason).toBeNull();
  });

  it("tells a provider's confirmation that passkeys are still there to sign in with", () => {
    const vm = build(ok(false, [google], { ...on, passkeys: [passkey, keychain] }));
    const social = vm.rows.find((row) => row.kind === "social");
    expect(social?.kind === "social" && social.confirm.body).toContain(
      "sign in with your passkeys",
    );
  });
});
