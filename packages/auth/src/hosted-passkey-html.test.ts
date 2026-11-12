import { describe, expect, it } from "vitest";
import { EMPTY_HOSTED_AUTH_CAPABILITIES, hostedAuthViewFromSearch } from "./hosted-auth/view.js";
import {
  buildHostedAddPasskeyHtml,
  buildHostedConfirmHtml,
  buildHostedLoginHtml,
  buildHostedPasskeyExpiredHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorSetupHtml,
  hasConfirmMethod,
} from "./index.js";

const textOf = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'");

const ON = {
  ...EMPTY_HOSTED_AUTH_CAPABILITIES,
  googleEnabled: true,
  appleEnabled: true,
  accountOrigin: "https://account.test",
  passkeysEnabled: true,
};
const OFF = { ...ON, passkeysEnabled: false };

const shop =
  "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=s&nonce=n&code_challenge=c&code_challenge_method=S256";
const shopAdmin =
  "response_type=code&client_id=lax-shop-admin&redirect_uri=http://localhost:3030/api/auth/callback&scope=openid&state=s&nonce=n&code_challenge=c&code_challenge_method=S256";
const reauth =
  "response_type=code&client_id=lax-account-web&redirect_uri=http://localhost:3040/api/auth/callback&scope=openid&state=s&nonce=n&code_challenge=c&code_challenge_method=S256&prompt=login&max_age=300";

const view = (search: string, capabilities = ON) => hostedAuthViewFromSearch(search, capabilities);

describe("sign-in page, passkeys on", () => {
  const html = buildHostedLoginHtml(view(shop));

  it("offers Google, Apple, then the passkey button, then the Terms line and the divider", () => {
    const google = html.indexOf("Continue with Google");
    const apple = html.indexOf("Continue with Apple");
    const passkey = html.indexOf("Sign in with a passkey");
    const terms = html.indexOf("By continuing, you agree");
    const divider = html.indexOf("auth-divider");
    expect(google).toBeGreaterThan(-1);
    expect(google).toBeLessThan(apple);
    expect(apple).toBeLessThan(passkey);
    expect(passkey).toBeLessThan(terms);
    expect(terms).toBeLessThan(divider);
  });

  it("renders the passkey button hidden, for the page script to show where passkeys work", () => {
    const button = html.match(/<button[^>]*data-passkey-button="true"[^>]*>/)?.[0] ?? "";
    expect(button).toMatch(/\shidden[\s>]/);
    expect(html).toContain('data-loading-label="Waiting for your passkey…"');
  });

  it("marks the email box so the browser can offer saved passkeys, and gives the quiet line a live region", () => {
    expect(html).toContain('autocomplete="username webauthn"');
    expect(html).toMatch(/id="passkey-note"[^>]*role="status"[^>]*hidden/);
  });

  it("keeps the methods block hidden when nothing but the passkey button is in it", () => {
    const only = buildHostedLoginHtml(
      view(shop, { ...ON, googleEnabled: false, appleEnabled: false }),
    );
    expect(only).toMatch(
      /class="social-actions" data-login-chrome="methods" hidden data-methods-empty="true"/,
    );
    expect(only).not.toContain("Continue with Google");
  });

  it("shows staff the passkey button and never Google or Apple", () => {
    const staff = buildHostedLoginHtml(view(shopAdmin));
    expect(staff).toContain("Sign in with a passkey");
    expect(staff).not.toContain("Continue with Google");
    expect(staff).not.toContain("Continue with Apple");
    expect(staff).not.toContain("By continuing, you agree");
  });
});

describe("sign-in page, passkeys off", () => {
  it("is exactly as it was: no passkey button, no passkey autofill", () => {
    const html = buildHostedLoginHtml(view(shop, OFF));
    expect(html).not.toContain("passkey");
    expect(html).toContain('autocomplete="username"');
  });

  it("shows staff nothing in the methods block", () => {
    expect(buildHostedLoginHtml(view(shopAdmin, OFF))).not.toContain("social-actions");
  });
});

describe("sign-up page", () => {
  it("never offers a passkey: it is added after the account exists", () => {
    const html = buildHostedSignUpHtml(view(shop, ON));
    expect(html).not.toContain("passkey");
    expect(html).toContain("Continue with Google");
  });
});

describe("Confirm it's you", () => {
  const person = { email: "collector@lax.bid" };
  const all = { password: true, passkey: true, providers: ["google"] as const, staff: false };

  it("is how a fresh sign-in asked for by LAX Account is recognised, and nothing else", () => {
    expect(view(reauth).flow.reauth).toBe(true);
    expect(view(shop).flow.reauth).toBe(false);
    expect(view(reauth.replace("&prompt=login", "")).flow.reauth).toBe(false);
    expect(view(`${shop}&prompt=login`).flow.reauth).toBe(false);
  });

  it("says why it asks, in the words for the reasons on its list", () => {
    const lead = (reason: string) =>
      textOf(
        buildHostedConfirmHtml(
          { ...person, methods: all },
          view(`${reauth}&reauth_reason=${reason}`),
        ),
      );
    expect(lead("add_sign_in_method")).toContain(
      "Before you add a way to sign in, we need you to sign in again.",
    );
    expect(lead("remove_sign_in_method")).toContain(
      "Before you remove a way to sign in, we need you to sign in again.",
    );
    expect(lead("change_password")).toContain(
      "Before you change your password, we need you to sign in again.",
    );
  });

  it("never words a reason that is not on the list, and ignores one on any other page", () => {
    const general = "Before you make this change, we need you to sign in again.";
    for (const raw of ["%3Cscript%3Ealert(1)%3C/script%3E", "delete_everything", ""]) {
      const url = `${reauth}&reauth_reason=${raw}`;
      expect(view(url).flow.reauthReason).toBeNull();
      const html = buildHostedConfirmHtml({ ...person, methods: all }, view(url));
      expect(textOf(html)).toContain(general);
      expect(html).not.toContain("<script>alert");
    }
    expect(view(`${shop}&reauth_reason=add_sign_in_method`).flow.reauthReason).toBeNull();
  });

  it("leads with the passkey, then the password, then Google, for the signed-in person", () => {
    const html = buildHostedConfirmHtml({ ...person, methods: all }, view(reauth));
    expect(html).toContain("<h1>Confirm it&#39;s you</h1>");
    const passkey = html.indexOf("Use your passkey");
    const password = html.indexOf('id="password"');
    const google = html.indexOf("Continue with Google");
    expect(passkey).toBeGreaterThan(-1);
    expect(passkey).toBeLessThan(password);
    expect(password).toBeLessThan(google);
    expect(html).not.toContain("Continue with Apple");
    expect(textOf(html)).toContain("collector@lax.bid");
    expect(html).toContain("Not you?");
    expect(html).toContain('data-email="collector@lax.bid"');
  });

  it("fixes the email: there is no email field to type another person's address into", () => {
    const html = buildHostedConfirmHtml({ ...person, methods: all }, view(reauth));
    expect(html).not.toContain('id="email"');
    expect(html).not.toContain('type="email"');
  });

  it("offers a password-only account just the password", () => {
    const html = buildHostedConfirmHtml(
      { ...person, methods: { password: true, passkey: false, providers: [], staff: false } },
      view(reauth),
    );
    expect(html).not.toContain("passkey");
    expect(html).not.toContain("Continue with");
    expect(html).toContain('id="password"');
    expect(html).toContain("Forgot your password?");
  });

  it("does not offer a passkey when passkeys are off, even if the account has one", () => {
    const html = buildHostedConfirmHtml({ ...person, methods: all }, view(reauth, OFF));
    expect(html).not.toContain("data-passkey-button");
  });

  it("does not offer a provider this environment does not have", () => {
    const html = buildHostedConfirmHtml(
      {
        ...person,
        methods: { password: false, passkey: true, providers: ["apple"], staff: false },
      },
      view(reauth, { ...ON, appleEnabled: false }),
    );
    expect(html).not.toContain("Continue with Apple");
  });

  it("never offers Google or Apple to a staff account, whatever is linked", () => {
    const html = buildHostedConfirmHtml(
      { ...person, methods: { ...all, providers: ["google"], staff: true } },
      view(reauth),
    );
    expect(html).not.toContain("Continue with Google");
    expect(html).toContain("Use your passkey");
    const onlyProvider = {
      password: false,
      passkey: false,
      providers: ["google"] as const,
      staff: true,
    };
    expect(hasConfirmMethod(onlyProvider, view(reauth))).toBe(false);
  });

  it("escapes an email that carries markup", () => {
    const html = buildHostedConfirmHtml(
      { email: '"><script>x</script>@lax.bid', methods: all },
      view(reauth),
    );
    expect(html).not.toContain("<script>x</script>");
  });

  it("has a way back to Security, and says why it asks", () => {
    const html = buildHostedConfirmHtml({ ...person, methods: all }, view(reauth));
    expect(html).toContain('href="https://account.test/account/security"');
    expect(textOf(html)).toContain("we need you to sign in again");
  });

  it("is only used when there is something to offer", () => {
    const none = { password: false, passkey: false, providers: [], staff: false };
    expect(hasConfirmMethod(none, view(reauth))).toBe(false);
    expect(hasConfirmMethod({ ...none, passkey: true }, view(reauth, OFF))).toBe(false);
    expect(hasConfirmMethod({ ...none, passkey: true }, view(reauth))).toBe(true);
    expect(hasConfirmMethod({ ...none, password: true }, view(reauth))).toBe(true);
    expect(hasConfirmMethod({ ...none, providers: ["google"] }, view(reauth))).toBe(true);
    expect(
      hasConfirmMethod(
        { ...none, providers: ["apple"] },
        view(reauth, { ...ON, appleEnabled: false }),
      ),
    ).toBe(false);
  });
});

describe("Add a passkey page", () => {
  const html = buildHostedAddPasskeyHtml(
    {
      returnUrl: "https://account.test/account/security",
      savedReturnUrl: "https://account.test/account/security?signInMethod=passkey_added",
    },
    view("", ON),
  );

  it("explains what a passkey is and where it is saved, with the exact design copy", () => {
    const text = textOf(html);
    expect(text).toContain("Add a passkey");
    expect(text).toContain("saved by your device or password manager, never by LAX");
    expect(text).toContain("iCloud Keychain, Google Password Manager");
    expect(text).toContain("Create a passkey");
    expect(text).toContain("Cancel");
  });

  it("leaves through Security only: Cancel goes plainly, Save goes with the confirmation", () => {
    expect(html).toMatch(
      /id="passkey-cancel"[^>]*href="https:\/\/account.test\/account\/security"/,
    );
    expect(html).toContain(
      'data-return-url="https://account.test/account/security?signInMethod=passkey_added"',
    );
  });

  it("has every state's markup, each but the first hidden", () => {
    expect(html).toMatch(/id="passkey-ready"/);
    expect(html).toMatch(/id="passkey-unsupported"[^>]*hidden/);
    expect(html).toMatch(/id="passkey-saved"[^>]*hidden/);
    expect(textOf(html)).toContain("This browser can't create passkeys");
    expect(html).toContain('id="passkey-name"');
    expect(textOf(html)).toContain("So you can tell your passkeys apart in Security.");
    expect(textOf(html)).toContain("Save and go back to LAX Account");
  });

  it("lets the script hide the note about syncing when the browser cannot make passkeys", () => {
    expect(html).toMatch(/id="passkey-sync-note"/);
  });

  it("loads only its own script", () => {
    expect(html).toContain('src="/hosted-passkey-add.js');
  });

  it("escapes a return address", () => {
    const evil = buildHostedAddPasskeyHtml(
      { returnUrl: 'https://a.test/"><script>x</script>' },
      view("", ON),
    );
    expect(evil).not.toContain("<script>x</script>");
  });
});

describe("expired page", () => {
  it("says the link has expired and offers only the way back, saying nothing about the account", () => {
    const html = buildHostedPasskeyExpiredHtml(
      { returnUrl: "https://account.test/account/security" },
      view("", ON),
    );
    const text = textOf(html);
    expect(text).toContain("This link has expired");
    expect(text).toContain("Go back to LAX Account and try again.");
    expect(html).toContain('id="passkey-back"');
    expect(html).not.toContain("passkey-create");
  });
});

describe("two-step setup an organisation requires", () => {
  it("offers a passkey as a way to meet it, when passkeys are on", () => {
    const html = buildHostedTwoFactorSetupHtml(view("", ON), "org");
    expect(textOf(html)).toContain("Add a passkey, or add a password and an authenticator app.");
    expect(html).toContain('href="https://account.test/account/security"');
  });

  it("is as it was when passkeys are off", () => {
    const html = buildHostedTwoFactorSetupHtml(view("", OFF), "org");
    expect(textOf(html)).toContain("Your organisation requires two-step verification.");
    expect(html).not.toContain("setup-add-passkey");
  });

  it("does not offer a passkey for the staff requirement here", () => {
    const html = buildHostedTwoFactorSetupHtml(view("", ON), "staff");
    expect(html).not.toContain("setup-add-passkey");
  });
});
