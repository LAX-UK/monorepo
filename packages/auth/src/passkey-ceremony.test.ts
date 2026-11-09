import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { type AuthDatabase, createAuth } from "./index.js";
import { passkeyConfigForIssuer } from "./passkey-plugin.js";
import { SoftwareAuthenticator } from "./test-support/software-authenticator.js";

/**
 * Real passkey ceremonies against the real Better Auth handler, with the issuer's passkey plugin
 * configured as in production. A software authenticator stands in for the browser and device, so
 * the three places the plugin is open by default (origin, user verification, two-step) are each
 * shown closed. A browser run of the same ceremonies comes with the hosted pages.
 */

const ISSUER = "https://auth.test";
const PASSWORD = "a-password-123";
const config = passkeyConfigForIssuer(ISSUER);
const good = { origin: config.origin, rpID: config.rpID };
const CHROME_ON_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

type Rows = Record<string, Record<string, unknown>[]>;

async function issuer() {
  const rows: Rows = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
    jwks: [],
    oauthApplication: [],
    oauthAccessToken: [],
    oauthConsent: [],
    passkey: [],
  };
  const markUsed = vi.fn(async () => undefined);
  const ports = {
    consentStore: { upsert: vi.fn(async (input) => input) },
    jwksStore: {
      getJwks: vi.fn(async () => []),
      getActiveSigningJwk: vi.fn(async () => null),
      createJwk: vi.fn(async (data) => ({ id: "kid-1", ...data })),
      getPublicJwks: vi.fn(async () => ({ keys: [] })),
      markKeyRetired: vi.fn(async () => undefined),
    },
    sessionStampStore: {
      stampPasswordAuth: vi.fn(async () => undefined),
      stampMfaCompleted: vi.fn(async () => undefined),
      stampSocialAuth: vi.fn(async () => undefined),
      stampPasskeyAuth: vi.fn(async () => undefined),
    },
    subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
    accountLinkReader: {
      countAccountsForUser: async (userId: string) =>
        rows.account?.filter((row) => row.userId === userId).length ?? 0,
      isEmailVerified: async () => true,
      findUserEmailProfile: async () => null,
    },
    phoneNumberStore: {
      purgeExpiredVerifications: vi.fn(async () => undefined),
      findPhoneNumber: vi.fn(async () => null),
      resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
    },
    twoFactorPolicyStore: {
      readSubjectPolicyInputs: async () => ({ markers: [], policies: [] }),
      readTwoFactorEnabled: async (ids: string[]) => new Map(ids.map((id) => [id, false])),
      readPolicy: async () => null,
      writePolicy: async () => undefined,
      countCoverage: async () => ({ members: 0, enrolled: 0 }),
      readLastSignIn: async () => new Map(),
    },
    email: undefined,
    sms: undefined,
    securityNotices: { notify: async () => undefined },
    events: { publish: async () => undefined },
  };
  const auth = createAuth({
    database: memoryAdapter(rows) as unknown as AuthDatabase,
    ports: ports as never,
    secret: "test-secret-that-is-long-enough-for-better-auth",
    baseURL: ISSUER,
    issuerURL: ISSUER,
    trustedOrigins: [ISSUER],
    passkey: { config, ports: { markUsed } },
  });
  const context = await (
    auth as unknown as {
      $context: Promise<{
        internalAdapter: {
          createUser(data: unknown): Promise<{ id: string }>;
          createAccount(data: unknown): Promise<unknown>;
        };
        password: { hash(value: string): Promise<string> };
      }>;
    }
  ).$context;
  const people = [
    {
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
      twoFactorEnabled: false,
    },
    { id: "u2", email: "grace@example.com", name: "Grace", twoFactorEnabled: false },
  ];
  for (const person of people) {
    const created = await context.internalAdapter.createUser({
      ...person,
      emailVerified: true,
    } as never);
    await context.internalAdapter.createAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await context.password.hash(PASSWORD),
    } as never);
  }

  /** A tiny cookie jar: what a browser would send back. */
  const jar = new Map<string, string>();
  const keep = (response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const at = pair?.indexOf("=") ?? -1;
      if (pair && at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const send = async (path: string, init: RequestInit = {}) => {
    const response = await auth.handler(
      new Request(`${ISSUER}/api/auth${path}`, {
        ...init,
        headers: {
          cookie: cookieHeader(),
          "user-agent": CHROME_ON_MAC,
          ...(init.method === "POST" ? { "content-type": "application/json" } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
      }),
    );
    keep(response);
    return response;
  };

  /** The person signs in with their password, so a session exists to make a passkey from. */
  async function signInWithPassword(email = "ada@example.com") {
    const response = await send("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
      headers: { origin: ISSUER },
    });
    expect(response.status).toBe(200);
  }

  const registrationChallenge = async () => {
    const response = await send("/passkey/generate-register-options");
    expect(response.status).toBe(200);
    return (await response.json()) as {
      challenge: string;
      rp: { id: string };
      authenticatorSelection: { residentKey: string; userVerification: string };
    };
  };
  const authenticationChallenge = async () => {
    const response = await send("/passkey/generate-authenticate-options");
    expect(response.status).toBe(200);
    return (await response.json()) as { challenge: string };
  };
  const register = async (
    device: SoftwareAuthenticator,
    ceremony: { origin: string; rpID: string; userVerified?: boolean },
    headers: Record<string, string> = {},
  ) => {
    const { challenge } = await registrationChallenge();
    return send("/passkey/verify-registration", {
      method: "POST",
      body: JSON.stringify({ response: device.register(challenge, ceremony) }),
      headers,
    });
  };
  const signInWithPasskey = async (
    device: SoftwareAuthenticator,
    ceremony: { origin: string; rpID: string; userVerified?: boolean },
    { keepSession = false }: { keepSession?: boolean } = {},
  ) => {
    if (!keepSession) jar.clear();
    const { challenge } = await authenticationChallenge();
    return send("/passkey/verify-authentication", {
      method: "POST",
      body: JSON.stringify({ response: device.assert(challenge, ceremony) }),
    });
  };

  return {
    rows,
    markUsed,
    send,
    jar,
    signInWithPassword,
    registrationChallenge,
    authenticationChallenge,
    register,
    signInWithPasskey,
  };
}

describe("creating a passkey", () => {
  it("asks the device for a discoverable credential and a check of the person, for the issuer's own relying party", async () => {
    const { signInWithPassword, registrationChallenge } = await issuer();
    await signInWithPassword();
    const options = await registrationChallenge();
    expect(options.rp.id).toBe("auth.test");
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
  });

  it("stores a passkey the device made for the issuer, named from the browser, and shows no key", async () => {
    const { signInWithPassword, register, rows } = await issuer();
    await signInWithPassword();
    const device = new SoftwareAuthenticator({ synced: true });
    const response = await register(device, good);
    expect(response.status).toBe(200);
    expect(rows.passkey).toHaveLength(1);
    expect(rows.passkey[0]).toMatchObject({
      userId: "u1",
      name: "Passkey on Chrome on macOS",
      backedUp: true,
      deviceType: "multiDevice",
    });
  });

  it("refuses a passkey the device made without checking the person, and stores nothing", async () => {
    const { signInWithPassword, register, rows } = await issuer();
    await signInWithPassword();
    const response = await register(new SoftwareAuthenticator(), { ...good, userVerified: false });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "passkey_user_verification_required" });
    expect(rows.passkey).toHaveLength(0);
  });

  it("takes the origin from configuration: a ceremony for any other origin is refused, whatever the request says", async () => {
    const { signInWithPassword, register, rows } = await issuer();
    await signInWithPassword();
    const device = new SoftwareAuthenticator();
    // The attacker's page runs the ceremony and tells the issuer it came from the attacker's origin.
    const attacker = { origin: "https://evil.test", rpID: config.rpID };
    const refused = await register(device, attacker, { origin: "https://evil.test" });
    expect(refused.status).not.toBe(200);
    expect(rows.passkey).toHaveLength(0);
  });

  it("does not trust the Origin header either way: the pinned origin is what counts", async () => {
    const { signInWithPassword, register, rows } = await issuer();
    await signInWithPassword();
    // A ceremony for the real origin passes even when the request's own Origin header lies.
    const response = await register(new SoftwareAuthenticator(), good, {
      origin: "https://evil.test",
    });
    expect(response.status).toBe(200);
    expect(rows.passkey).toHaveLength(1);
  });

  it("refuses a passkey made for another relying party", async () => {
    const { signInWithPassword, register, rows } = await issuer();
    await signInWithPassword();
    const response = await register(new SoftwareAuthenticator(), {
      origin: config.origin,
      rpID: "lax.bid",
    });
    expect(response.status).not.toBe(200);
    expect(rows.passkey).toHaveLength(0);
  });

  it("will not take a second answer to the same challenge", async () => {
    const { signInWithPassword, registrationChallenge, send, rows } = await issuer();
    await signInWithPassword();
    const { challenge } = await registrationChallenge();
    const device = new SoftwareAuthenticator();
    const body = JSON.stringify({ response: device.register(challenge, good) });
    expect((await send("/passkey/verify-registration", { method: "POST", body })).status).toBe(200);
    expect((await send("/passkey/verify-registration", { method: "POST", body })).status).not.toBe(
      200,
    );
    expect(rows.passkey).toHaveLength(1);
  });

  it("needs a signed-in session", async () => {
    const { send } = await issuer();
    const response = await send("/passkey/generate-register-options");
    expect(response.status).toBe(401);
  });
});

describe("signing in with a passkey", () => {
  async function withPasskey(options: { synced?: boolean } = {}) {
    const harness = await issuer();
    await harness.signInWithPassword();
    const device = new SoftwareAuthenticator(options);
    expect((await harness.register(device, good)).status).toBe(200);
    return { ...harness, device };
  }

  it("signs the person in with no email asked for first, and records the passkey as used", async () => {
    const { signInWithPasskey, device, rows, markUsed, jar } = await withPasskey();
    const before = rows.session.length;
    const response = await signInWithPasskey(device, good);
    expect(response.status).toBe(200);
    expect(rows.session.length).toBe(before + 1);
    expect([...jar.keys()].some((name) => name.includes("session_token"))).toBe(true);
    expect(await response.json()).toMatchObject({ user: { id: "u1" } });
    expect(markUsed).toHaveBeenCalledWith(device.id);
  });

  it("refuses a sign-in the device did not check the person for, creating no session", async () => {
    const { signInWithPasskey, device, rows, markUsed } = await withPasskey();
    const before = rows.session.length;
    const response = await signInWithPasskey(device, { ...good, userVerified: false });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "passkey_user_verification_required" });
    expect(rows.session.length).toBe(before);
    expect(markUsed).not.toHaveBeenCalled();
  });

  it("refuses a sign-in for another origin or another relying party", async () => {
    const { signInWithPasskey, device, rows } = await withPasskey();
    const before = rows.session.length;
    expect(
      (await signInWithPasskey(device, { origin: "https://evil.test", rpID: config.rpID })).status,
    ).not.toBe(200);
    expect(
      (await signInWithPasskey(device, { origin: config.origin, rpID: "lax.bid" })).status,
    ).not.toBe(200);
    expect(rows.session.length).toBe(before);
  });

  it("refuses a passkey the issuer does not know", async () => {
    const { signInWithPasskey, rows } = await withPasskey();
    const before = rows.session.length;
    const stranger = new SoftwareAuthenticator();
    expect((await signInWithPasskey(stranger, good)).status).toBe(401);
    expect(rows.session.length).toBe(before);
  });

  it("will not take a second answer to the same challenge (replay)", async () => {
    const { authenticationChallenge, send, device, rows, jar } = await withPasskey();
    jar.clear();
    const { challenge } = await authenticationChallenge();
    const body = JSON.stringify({ response: device.assert(challenge, good) });
    const cookies = new Map(jar);
    expect((await send("/passkey/verify-authentication", { method: "POST", body })).status).toBe(
      200,
    );
    const sessions = rows.session.length;
    jar.clear();
    for (const [name, value] of cookies) jar.set(name, value);
    expect(
      (await send("/passkey/verify-authentication", { method: "POST", body })).status,
    ).not.toBe(200);
    expect(rows.session.length).toBe(sessions);
  });
});

describe("the plugin's own management endpoints", () => {
  it.each([
    ["GET", "/passkey/list-user-passkeys"],
    ["POST", "/passkey/update-passkey"],
    ["POST", "/passkey/delete-passkey"],
  ])(
    "%s %s is switched off, so naming and removal go only through LAX Account",
    async (method, path) => {
      const { signInWithPassword, register, send, rows } = await issuer();
      await signInWithPassword();
      await register(new SoftwareAuthenticator(), good);
      const id = String(rows.passkey[0]?.id);
      const response = await send(path, {
        method,
        ...(method === "POST" ? { body: JSON.stringify({ id, name: "x" }) } : {}),
      });
      expect(response.status).toBe(404);
      expect(rows.passkey).toHaveLength(1);
      expect(rows.passkey[0]?.name).not.toBe("x");
    },
  );
});

describe("a person with two-step verification on signs in with a passkey", () => {
  /** Ada makes a passkey, then turns on two-step verification (an authenticator app). */
  async function withTwoStepOn() {
    const harness = await issuer();
    await harness.signInWithPassword();
    const device = new SoftwareAuthenticator();
    expect((await harness.register(device, good)).status).toBe(200);
    const ada = harness.rows.user.find((row) => row.id === "u1");
    if (!ada) throw new Error("no Ada");
    ada.twoFactorEnabled = true;
    return { ...harness, device };
  }

  it("is signed in without being sent to the code page: the passkey is both factors", async () => {
    const { signInWithPasskey, device, rows, jar } = await withTwoStepOn();
    const sessions = rows.session.length;
    const response = await signInWithPasskey(device, good);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: "u1" } });
    // No code page, no pending-challenge cookie, and the session is kept.
    expect(response.headers.get("location")).toBeNull();
    expect([...jar.keys()].some((name) => name.includes("two_factor"))).toBe(false);
    expect([...jar.keys()].some((name) => name.includes("session_token"))).toBe(true);
    expect(rows.session.length).toBe(sessions + 1);
  });

  it("still refuses a passkey the device did not check the person for", async () => {
    const { signInWithPasskey, device, rows } = await withTwoStepOn();
    const before = rows.session.length;
    const response = await signInWithPasskey(device, { ...good, userVerified: false });
    expect(response.status).toBe(403);
    expect(rows.session.length).toBe(before);
  });
});

describe("another person's passkey", () => {
  async function twoPeopleWithPasskeys() {
    const harness = await issuer();
    // Grace makes a passkey, then signs out.
    await harness.signInWithPassword("grace@example.com");
    const graces = new SoftwareAuthenticator({ userHandle: "u2" });
    expect((await harness.register(graces, good)).status).toBe(200);
    harness.jar.clear();
    // Ada makes hers.
    await harness.signInWithPassword("ada@example.com");
    const adas = new SoftwareAuthenticator({ userHandle: "u1" });
    expect((await harness.register(adas, good)).status).toBe(200);
    return { ...harness, graces, adas };
  }

  it("cannot pass for the signed-in person when they confirm it is them", async () => {
    const { signInWithPasskey, graces, rows, jar } = await twoPeopleWithPasskeys();
    // Ada's browser is signed in; she is asked to confirm it's her, and Grace's device answers.
    const sessions = rows.session.length;
    const response = await signInWithPasskey(graces, good, { keepSession: true });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "passkey_wrong_person" });
    expect(rows.session.length).toBe(sessions);
    expect(jar.size).toBeGreaterThan(0);
  });

  it("lets the signed-in person confirm it is them with their own passkey", async () => {
    const { signInWithPasskey, adas, rows } = await twoPeopleWithPasskeys();
    const sessions = rows.session.length;
    const response = await signInWithPasskey(adas, good, { keepSession: true });
    expect(response.status).toBe(200);
    expect(rows.session.length).toBe(sessions + 1);
  });

  it("signs a browser with no session in as the passkey's own person", async () => {
    const { signInWithPasskey, graces } = await twoPeopleWithPasskeys();
    const response = await signInWithPasskey(graces, good);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: "u2" } });
  });
});

describe("the signature counter", () => {
  async function withPasskey(options: { counter?: "increment" | "zero"; synced?: boolean }) {
    const harness = await issuer();
    await harness.signInWithPassword();
    const device = new SoftwareAuthenticator(options);
    expect((await harness.register(device, good)).status).toBe(200);
    return { ...harness, device };
  }

  it("lets a device-bound passkey sign in again and again as its counter goes up", async () => {
    const { signInWithPasskey, device } = await withPasskey({ counter: "increment" });
    for (let time = 0; time < 3; time += 1) {
      expect((await signInWithPasskey(device, good)).status).toBe(200);
    }
  });

  it("refuses a cloned authenticator whose counter goes backwards, creating no session", async () => {
    const { signInWithPasskey, device, rows } = await withPasskey({ counter: "increment" });
    expect((await signInWithPasskey(device, good)).status).toBe(200);
    expect((await signInWithPasskey(device, good)).status).toBe(200);
    const sessions = rows.session.length;
    // The clone has only seen the first sign-in: it answers with counter 1 after the issuer saw 2.
    device.rewindTo(1);
    expect((await signInWithPasskey(device, good)).status).not.toBe(200);
    expect(rows.session.length).toBe(sessions);
  });

  it("refuses a counter that stands still once it has counted", async () => {
    const { signInWithPasskey, device } = await withPasskey({ counter: "increment" });
    expect((await signInWithPasskey(device, good)).status).toBe(200);
    device.rewindTo(1);
    expect((await signInWithPasskey(device, good)).status).not.toBe(200);
  });

  it("lets a synced passkey that always says zero sign in, because it keeps no count", async () => {
    const { signInWithPasskey, device, rows } = await withPasskey({
      counter: "zero",
      synced: true,
    });
    const sessions = rows.session.length;
    expect((await signInWithPasskey(device, good)).status).toBe(200);
    expect((await signInWithPasskey(device, good)).status).toBe(200);
    expect(rows.session.length).toBe(sessions + 2);
  });
});
