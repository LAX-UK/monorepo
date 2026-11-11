import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  type PasskeyFailure,
  failureFromBrowserError,
  failureFromResponse,
} from "./passkey-outcome.js";

/** The issuer's own passkey endpoints: the only place a passkey ceremony is ever sent. */
const PASSKEY_API = "/api/auth/passkey";

export type PasskeyResult<T> = { ok: true; data: T } | { ok: false; failure: PasskeyFailure };

/** What the page needs back from a new passkey; never the key or its id. */
export type CreatedPasskey = {
  id: string;
  name: string;
  synced: boolean;
  kind: "platform" | "security_key";
};

/** The browser features the ceremonies use, and the network, so a test can stand in for both. */
export type PasskeyRuntime = {
  supportsPasskeys(): boolean;
  supportsAutofill(): Promise<boolean>;
  authenticate(input: {
    optionsJSON: PublicKeyCredentialRequestOptionsJSON;
    useBrowserAutofill?: boolean;
  }): Promise<unknown>;
  register(input: { optionsJSON: PublicKeyCredentialCreationOptionsJSON }): Promise<unknown>;
  fetch: typeof fetch;
};

export const browserPasskeyRuntime: PasskeyRuntime = {
  supportsPasskeys: () => browserSupportsWebAuthn(),
  supportsAutofill: () => browserSupportsWebAuthnAutofill(),
  authenticate: ({ optionsJSON, useBrowserAutofill }) =>
    startAuthentication({ optionsJSON, ...(useBrowserAutofill ? { useBrowserAutofill } : {}) }),
  register: (input) => startRegistration(input),
  fetch: (...args) => fetch(...args),
};

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function postAnswer(
  runtime: PasskeyRuntime,
  path: string,
  body: unknown,
): Promise<{ response: Response; data: unknown }> {
  const response = await runtime.fetch(`${PASSKEY_API}/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, data: await readJson(response) };
}

async function getChallenge(runtime: PasskeyRuntime, path: string): Promise<unknown | Failure> {
  const response = await runtime.fetch(`${PASSKEY_API}/${path}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  const data = await readJson(response);
  return response.ok && data ? data : new Failure(failureFromResponse(response.status, data));
}

/** A refusal, carried between the steps of a ceremony. */
class Failure {
  constructor(readonly failure: PasskeyFailure) {}
}

/**
 * Signs in with a passkey: asks the issuer for a challenge, lets the device answer it, and gives
 * the answer back for the issuer to check. No email is sent first (the passkey says who it
 * belongs to), so nothing here can reveal whether an address has an account. Returns the issuer's
 * own answer (where to go next) on success.
 *
 * `autofill` starts the quiet request that lets the browser offer saved passkeys in the email box.
 */
export async function signInWithPasskey(
  runtime: PasskeyRuntime,
  options: { autofill?: boolean } = {},
): Promise<PasskeyResult<unknown>> {
  const challenge = await getChallenge(runtime, "generate-authenticate-options").catch(
    () => new Failure("unavailable"),
  );
  if (challenge instanceof Failure) return { ok: false, failure: challenge.failure };
  let answer: unknown;
  try {
    answer = await runtime.authenticate({
      optionsJSON: challenge as PublicKeyCredentialRequestOptionsJSON,
      ...(options.autofill ? { useBrowserAutofill: true } : {}),
    });
  } catch (error) {
    return { ok: false, failure: failureFromBrowserError(error) };
  }
  try {
    const { clientExtensionResults: _dropped, ...response } = answer as Record<string, unknown>;
    const verified = await postAnswer(runtime, "verify-authentication", { response });
    if (!verified.response.ok) {
      return { ok: false, failure: failureFromResponse(verified.response.status, verified.data) };
    }
    return { ok: true, data: verified.data };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}

function isCreated(data: unknown): data is { passkey: CreatedPasskey } {
  const passkey = (data as { passkey?: Partial<CreatedPasskey> } | null)?.passkey;
  return typeof passkey?.id === "string" && typeof passkey.name === "string";
}

/**
 * Makes a passkey on this device. The issuer only answers when the browser holds the one-time
 * permission the hand-off from LAX Account gives; without it every step is refused as expired.
 */
export async function createPasskey(
  runtime: PasskeyRuntime,
): Promise<PasskeyResult<CreatedPasskey>> {
  const challenge = await getChallenge(runtime, "generate-register-options").catch(
    () => new Failure("unavailable"),
  );
  if (challenge instanceof Failure) return { ok: false, failure: challenge.failure };
  let answer: unknown;
  try {
    answer = await runtime.register({
      optionsJSON: challenge as PublicKeyCredentialCreationOptionsJSON,
    });
  } catch (error) {
    return { ok: false, failure: failureFromBrowserError(error) };
  }
  try {
    const { clientExtensionResults: _dropped, ...response } = answer as Record<string, unknown>;
    const verified = await postAnswer(runtime, "verify-registration", { response });
    if (!verified.response.ok) {
      return { ok: false, failure: failureFromResponse(verified.response.status, verified.data) };
    }
    if (!isCreated(verified.data)) return { ok: false, failure: "unavailable" };
    return { ok: true, data: verified.data.passkey };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}
