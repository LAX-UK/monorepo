import {
  type SessionStampStore,
  type createAuth,
  stampPasskeyAuthFromResponse,
} from "@auction/auth";
import { isValidPasskeyName } from "@auction/identity-contracts";
import { normaliseRequestPath } from "../lib/normalise-request-path.js";
import type { PasskeyEnrolmentGrants } from "../services/passkey-enrolment-grant.js";
import { presentRegisteredPasskey } from "../services/present-registered-passkey.js";
import {
  type SecurityEffectLogger,
  describeError,
  settleSecurityEffect,
} from "../services/settle-security-effect.js";

export const PASSKEY_NOT_ALLOWED = "passkey_enrolment_not_allowed";
export const PASSKEY_NAME_INVALID = "passkey_name_invalid";

type Step = "register_options" | "register_verify" | "authenticate_verify";

/** Which passkey call a path is, written however it was written; null for any other call. */
export function passkeyStepOf(path: string): Step | null {
  const normal = normaliseRequestPath(path);
  if (normal.endsWith("/passkey/generate-register-options")) return "register_options";
  if (normal.endsWith("/passkey/verify-registration")) return "register_verify";
  if (normal.endsWith("/passkey/verify-authentication")) return "authenticate_verify";
  return null;
}

/** What the issuer knows of a passkey before the plugin checks the device's answer. */
export type PasskeyCounterReader = {
  findByCredentialId(
    credentialId: string,
  ): Promise<{ id: string; userId: string; counter: number } | null>;
};

export type PasskeyRequestPorts = {
  grants: Pick<PasskeyEnrolmentGrants, "holds" | "spend" | "grant">;
  /** Runs once a passkey has been made: the one security email. The audit event is already stored. */
  onRegistered(input: {
    userId: string;
    name: string | null;
    userAgent: string | null;
  }): Promise<void>;
  /** Lets a signature counter that goes backwards (a cloned authenticator) be told apart in the logs. */
  counters?: PasskeyCounterReader;
};

/** The permission a passkey creation is running on, to give back if the creation fails. */
export type Enrolment = { userId: string; sessionId: string };

export type PasskeyBefore =
  | { kind: "answer"; response: Response }
  | { kind: "forward"; request: Request; enrolment: Enrolment | null };

const unavailable = () =>
  Response.json(
    {
      code: "TEMPORARILY_UNAVAILABLE",
      message: "We couldn't complete that just now. Please try again in a moment.",
    },
    { status: 503, headers: { "Retry-After": "5" } },
  );

/** The signature counter inside a device's assertion: four bytes after the flags. */
export function counterOfAssertion(
  body: unknown,
): { credentialId: string; counter: number } | null {
  const response = (
    body as { response?: { id?: unknown; response?: { authenticatorData?: unknown } } }
  )?.response;
  const data = response?.response?.authenticatorData;
  if (typeof response?.id !== "string" || typeof data !== "string") return null;
  const bytes = Buffer.from(data, "base64url");
  if (bytes.length < 37) return null;
  return { credentialId: response.id, counter: bytes.readUInt32BE(33) };
}

/**
 * The issuer's rules around Better Auth's passkey calls, in one place:
 *
 *  - making a passkey needs the permission the one-time hand-off gives. Asking for the challenge
 *    only checks it; the device's answer uses it up before anything is made (one step-up, one
 *    passkey) and gives it back when the plugin refuses, so a refused try can be repeated;
 *  - the challenge's `name` is dropped, so the name the device shows is always the account email;
 *  - the passkey's own name is a short line with no control or format characters;
 *  - the plugin's answer is trimmed to what the page needs, never the public key;
 *  - a verified passkey sign-in is stamped as two-step; a signature counter that goes backwards
 *    is reported (the plugin refuses it).
 *
 * Fails closed: when the session or the permission cannot be read, nothing is made.
 */
export function createPasskeyRequestPolicy(deps: {
  log: SecurityEffectLogger;
  auth: ReturnType<typeof createAuth>;
  sessionStampStore: SessionStampStore;
  passkeys: PasskeyRequestPorts | undefined;
}) {
  async function gate(request: Request, step: Step, path: string): Promise<PasskeyBefore> {
    const passkeys = deps.passkeys;
    if (!passkeys) {
      return { kind: "answer", response: Response.json({ code: "NOT_FOUND" }, { status: 404 }) };
    }
    try {
      const found = await deps.auth.api.getSession({ headers: request.headers });
      const userId = found?.user?.id;
      const sessionId = found?.session?.id;
      if (!userId || !sessionId) {
        return {
          kind: "answer",
          response: Response.json({ code: "UNAUTHORIZED" }, { status: 401 }),
        };
      }
      const notAllowed = {
        kind: "answer" as const,
        response: Response.json({ code: PASSKEY_NOT_ALLOWED }, { status: 403 }),
      };
      if (step === "register_options") {
        if (!(await passkeys.grants.holds(sessionId, userId))) return notAllowed;
        // The name the device shows is the account's email, whatever the caller asked for.
        const url = new URL(request.url);
        url.searchParams.delete("name");
        return {
          kind: "forward",
          request: new Request(url, request),
          enrolment: null,
        };
      }
      if (!(await hasValidPasskeyName(request))) {
        return {
          kind: "answer",
          response: Response.json({ code: PASSKEY_NAME_INVALID }, { status: 400 }),
        };
      }
      // Used up atomically: of two answers made with one step-up, only one gets through.
      if (!(await passkeys.grants.spend(sessionId, userId))) return notAllowed;
      return { kind: "forward", request, enrolment: { userId, sessionId } };
    } catch (error) {
      deps.log.error({ ...describeError(error), path }, "auth_passkey_gate_failed");
      return { kind: "answer", response: unavailable() };
    }
  }

  async function reportCounterRegression(request: Request, path: string): Promise<void> {
    const counters = deps.passkeys?.counters;
    if (!counters) return;
    try {
      const seen = counterOfAssertion(await request.clone().json());
      if (!seen) return;
      const stored = await counters.findByCredentialId(seen.credentialId);
      if (!stored) return;
      // A passkey that never counts (synced ones report zero) is fine; one that counts must go up.
      if ((seen.counter > 0 || stored.counter > 0) && seen.counter <= stored.counter) {
        deps.log.warn(
          {
            path,
            userId: stored.userId,
            passkeyId: stored.id,
            storedCounter: stored.counter,
            receivedCounter: seen.counter,
          },
          "passkey_counter_regression",
        );
      }
    } catch (error) {
      deps.log.warn({ ...describeError(error), path }, "passkey_counter_check_failed");
    }
  }

  return {
    /** Before the plugin runs: the gate, and what to look at. */
    async before(request: Request, path: string): Promise<PasskeyBefore | null> {
      const step = passkeyStepOf(path);
      if (!step) return null;
      if (step === "authenticate_verify") {
        await reportCounterRegression(request, path);
        return { kind: "forward", request, enrolment: null };
      }
      return gate(request, step, path);
    },

    /** After the plugin answered: the email, the trimmed answer, the stamp. */
    async after(input: {
      request: Request;
      response: Response;
      path: string;
      enrolment: Enrolment | null;
    }): Promise<Response> {
      const step = passkeyStepOf(input.path);
      const { response, enrolment } = input;
      if (step === "authenticate_verify" && response.ok) {
        // The device checked the person (the issuer refuses a passkey that did not), so the
        // session counts as two-step. Fails safe: an unstamped session reads as password-only.
        await settleSecurityEffect(
          deps.log,
          { path: input.path, effect: "stamp_passkey_auth" },
          () => stampPasskeyAuthFromResponse(deps.sessionStampStore, response),
        );
        return response;
      }
      if (step !== "register_verify" || !enrolment || !deps.passkeys) return response;
      if (!response.ok) {
        // Nothing was made: the permission goes back, so the person can try again.
        await settleSecurityEffect(
          deps.log,
          { path: input.path, effect: "passkey_permission_returned", userId: enrolment.userId },
          () =>
            deps.passkeys?.grants.grant(enrolment.sessionId, enrolment.userId) ?? Promise.resolve(),
        );
        return response;
      }
      const made = await readMadePasskey(response);
      await settleSecurityEffect(
        deps.log,
        { path: input.path, effect: "passkey_registered", userId: enrolment.userId },
        () =>
          deps.passkeys?.onRegistered({
            userId: enrolment.userId,
            name: made?.name ?? null,
            userAgent: input.request.headers.get("user-agent"),
          }) ?? Promise.resolve(),
      );
      return trimmedRegistrationResponse(response, made);
    },
  };
}

/** A name is optional (the issuer suggests one); when given it is a short, clean line. */
async function hasValidPasskeyName(request: Request): Promise<boolean> {
  try {
    const body = (await request.clone().json()) as { name?: unknown };
    if (body.name === undefined) return true;
    return typeof body.name === "string" && isValidPasskeyName(body.name);
  } catch {
    return false;
  }
}

type MadePasskey = ReturnType<typeof presentRegisteredPasskey>;

/** What the plugin stored, read from its answer, shaped as the person sees a passkey. */
async function readMadePasskey(response: Response): Promise<MadePasskey | null> {
  try {
    return presentRegisteredPasskey(await response.clone().json());
  } catch {
    return null;
  }
}

/** The plugin's answer carries the public key; the page gets only what it shows. */
function trimmedRegistrationResponse(response: Response, made: MadePasskey | null): Response {
  if (!made) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ passkey: made }), { status: response.status, headers });
}
