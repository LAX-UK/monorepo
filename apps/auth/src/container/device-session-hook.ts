import { readRequestRegion } from "@auction/auth";
import {
  type DeviceMarkerHasher,
  deviceMarkerSetCookie,
  mintDeviceMarker,
  readDeviceMarker,
} from "../services/device-marker.js";
import type { SessionTakeoverService } from "../services/session-takeover.service.js";
import {
  type SecurityEffectLogger,
  settleSecurityEffect,
} from "../services/settle-security-effect.js";
import {
  headersWithResponseSessionCookie,
  readRequestSessionToken,
  readResponseSessionToken,
  withAppendedSetCookie,
} from "./better-auth-session-cookies.js";

export type DeviceSessionHook = (input: {
  request: Request;
  response: Response;
  path: string;
}) => Promise<Response>;

/** What the hook needs from the sign-in library: who a request's session cookie signs in. */
export type SessionReader = (headers: Headers) => Promise<{ id?: string | null } | null>;

/** A browser navigating to a page, as opposed to a script, a product's server or a cache warming. */
function isBrowserNavigation(request: Request): boolean {
  return (
    request.headers.get("sec-fetch-mode") === "navigate" ||
    (request.headers.get("accept") ?? "").includes("text/html")
  );
}

/** A response a shared cache may keep and hand to someone else (discovery, JWKS), so it never carries a cookie. */
function isSharedCacheable(response: Response): boolean {
  return /\b(public|s-maxage)\b/i.test(response.headers.get("cache-control") ?? "");
}

const NO_COUNTRY = new Set(["XX", "T1"]);

/** An ISO 3166-1 alpha-2 code from an edge header, or null for anything else (unknown, Tor). */
export function normaliseCountry(region: string | null): string | null {
  const code = region?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(code) && !NO_COUNTRY.has(code) ? code : null;
}

/**
 * The single place where a response that sets a new session cookie is handled, whichever sign-in
 * method produced it (password, email link, Google or Apple, two-step, passkey, "Confirm it's
 * you", switching account):
 *
 * - the browser gets its private device marker (and keeps it fresh when it loads a page); only a
 *   keyed hash of it is stored on the session record;
 * - the new record takes over the record the browser already had (see SessionTakeoverService).
 *
 * The marker never decides who is signed in. A failure to take over is logged and retried, and
 * never fails the sign-in itself: the person is already signed in, and the worst case is a record
 * that expires on its own.
 */
export function createDeviceSessionHook(options: {
  takeover: Pick<SessionTakeoverService, "takeOver">;
  hasher: Pick<DeviceMarkerHasher, "hash">;
  readSession: SessionReader;
  log: SecurityEffectLogger;
}): DeviceSessionHook {
  return async ({ request, response, path }) => {
    if (response.status >= 400 || isSharedCacheable(response)) return response;
    const carried = readDeviceMarker(request.headers.get("cookie"));
    const newToken = readResponseSessionToken(response);
    // The same cookie again is a refresh of the record the browser already holds, not a sign-in.
    const isNewSignIn = newToken !== null && newToken !== readRequestSessionToken(request);
    // The marker is renewed when a sign-in happens or the browser loads a page, not on every call.
    if (!isNewSignIn && !(carried && isBrowserNavigation(request))) return response;

    const marker = carried ?? mintDeviceMarker();
    if (isNewSignIn) {
      await settleSecurityEffect(options.log, { path, effect: "session_takeover" }, async () => {
        const [current, previous] = await Promise.all([
          options.readSession(headersWithResponseSessionCookie(request, response)),
          options.readSession(request.headers),
        ]);
        if (!current?.id || previous?.id === current.id) return;
        await options.takeover.takeOver({
          newSessionId: current.id,
          previousSessionId: previous?.id ?? null,
          deviceHash: options.hasher.hash(marker),
          country: normaliseCountry(readRequestRegion(request.headers)),
        });
      });
    }
    return withAppendedSetCookie(response, deviceMarkerSetCookie(marker));
  };
}
