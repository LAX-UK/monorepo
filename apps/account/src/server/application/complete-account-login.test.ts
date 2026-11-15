import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LaxAccountConfig } from "../config";
import { createMemorySessionStore } from "../infrastructure/memory-session-store";
import type { SessionStore } from "../ports/session-store";
import { completeAccountLogin, endPendingAccountLogin } from "./complete-account-login";
import type { PendingAccountLogin } from "./start-account-login";

const verifyIdentityToken = vi.fn();
const requestToken = vi.fn();

vi.mock("@auction/identity-contracts/verify", () => ({
  verifyIdentityToken: (...args: unknown[]) => verifyIdentityToken(...args),
}));
vi.mock("../infrastructure/account-token-endpoint", () => ({
  createAccountTokenEndpoint: () => ({ requestToken }),
}));

const config = {
  publicOrigin: "https://account.test",
  oidcIssuer: "https://auth.test",
  oidcInternalIssuer: "https://auth.test",
  oidcClientId: "lax-account-web",
  sessionTtlSeconds: 3600,
} as LaxAccountConfig;

const base: PendingAccountLogin = {
  state: "state-1",
  nonce: "nonce-1",
  codeVerifier: "verifier",
  returnTo: "/account/security",
};

function sessions() {
  return {
    save: vi.fn(async () => undefined),
    claimPendingLogin: vi.fn(async () => true),
    settlePendingLogin: vi.fn(async () => true),
  } as unknown as SessionStore & {
    save: ReturnType<typeof vi.fn>;
  };
}

function signedInAs(subject: string) {
  verifyIdentityToken.mockResolvedValue({
    subject,
    payload: {
      nonce: "nonce-1",
      auth_time: Math.floor(Date.now() / 1000),
      sid: "sid-new",
      email: "x@lax.bid",
      acr: "",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestToken.mockResolvedValue({
    id_token: "id",
    refresh_token: "refresh",
    access_token: "access",
    expires_in: 300,
  });
});

describe("completeAccountLogin on a step-up", () => {
  it("saves the session when the person who asked is the one who came back", async () => {
    signedInAs("user-a");
    const store = sessions();
    const result = await completeAccountLogin({
      config,
      pending: { ...base, reauth: true, reauthSubject: "user-a" },
      receivedState: "state-1",
      code: "code",
      sessions: store,
    });
    expect(result.subject).toBe("user-a");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("refuses another person, such as one whose passkey was used, and saves nothing", async () => {
    signedInAs("user-b");
    const store = sessions();
    await expect(
      completeAccountLogin({
        config,
        pending: { ...base, reauth: true, reauthSubject: "user-a" },
        receivedState: "state-1",
        code: "code",
        sessions: store,
      }),
    ).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("refuses a step-up that does not say who asked, and saves nothing", async () => {
    signedInAs("user-a");
    const store = sessions();
    await expect(
      completeAccountLogin({
        config,
        pending: { ...base, reauth: true },
        receivedState: "state-1",
        code: "code",
        sessions: store,
      }),
    ).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("leaves an ordinary sign-in alone", async () => {
    signedInAs("user-b");
    const store = sessions();
    await completeAccountLogin({
      config,
      pending: base,
      receivedState: "state-1",
      code: "code",
      sessions: store,
    });
    expect(store.save).toHaveBeenCalledTimes(1);
  });
});

describe("completeAccountLogin after a sign-out", () => {
  const complete = (store: SessionStore) =>
    completeAccountLogin({
      config,
      pending: base,
      receivedState: "state-1",
      code: "code",
      sessions: store,
    });

  it("does not exchange the code of a sign-in that a sign-out ended", async () => {
    signedInAs("user-a");
    const store = createMemorySessionStore();
    await endPendingAccountLogin({ pending: base, sessions: store });

    await expect(complete(store)).rejects.toMatchObject({ signedOut: true });
    expect(requestToken).not.toHaveBeenCalled();
  });

  it("ends the session when the sign-out lands while the code is being exchanged", async () => {
    signedInAs("user-a");
    const store = createMemorySessionStore();
    const save = vi.spyOn(store, "save");
    requestToken.mockImplementationOnce(async () => {
      await endPendingAccountLogin({ pending: base, sessions: store });
      return { id_token: "id", refresh_token: "refresh", access_token: "a", expires_in: 300 };
    });

    await expect(complete(store)).rejects.toMatchObject({
      name: "PendingLoginEndedError",
      signedOut: true,
    });
    const savedId = save.mock.calls[0]?.[0] as string;
    expect(await store.get(savedId)).toBeNull();
  });

  it("ends the session a sign-in already created when the sign-out comes after it", async () => {
    signedInAs("user-a");
    const store = createMemorySessionStore();
    const { sessionId } = await complete(store);
    expect(await store.get(sessionId)).not.toBeNull();

    await endPendingAccountLogin({ pending: base, sessions: store });
    expect(await store.get(sessionId)).toBeNull();
  });

  it("accepts each sign-in's callback only once", async () => {
    signedInAs("user-a");
    const store = createMemorySessionStore();
    await complete(store);

    await expect(complete(store)).rejects.toMatchObject({
      name: "PendingLoginEndedError",
      signedOut: false,
    });
    expect(requestToken).toHaveBeenCalledTimes(1);
  });
});
