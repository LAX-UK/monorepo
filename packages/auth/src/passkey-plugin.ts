import { passkey } from "@better-auth/passkey";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { suggestPasskeyName } from "./passkey-names.js";

/**
 * Where passkeys live: the issuer's own address, and nowhere else. The relying party id is the
 * issuer's host (`auth.lax.bid`, `test-auth.lax.bid` on test, so a test passkey never appears on
 * the live site) and the origin is the issuer's origin. Both are fixed here from configuration:
 * the plugin would otherwise read the origin from the request's own `Origin` header, which a
 * caller controls.
 */
export type PasskeyConfig = {
  /** The issuer's host, with no scheme or port: the passkey's relying party. */
  rpID: string;
  /** The issuer's origin, `https://auth.lax.bid`: the only origin a ceremony may come from. */
  origin: string;
  /** What the device shows when it asks the person to confirm. */
  rpName: string;
};

export type PasskeyPorts = {
  /** Records that a passkey was just used to sign in (its `last_used_at`). */
  markUsed(credentialId: string): Promise<void>;
};

/** Said when a browser that is signed in as one person is given another person's passkey. */
export const PASSKEY_WRONG_PERSON = "passkey_wrong_person";

/** Said to the hosted page and LAX Account when a device did not check the person. */
export const PASSKEY_USER_VERIFICATION_REQUIRED = "passkey_user_verification_required";

/** The config for an issuer URL: its host and origin, nothing taken from a request. */
export function passkeyConfigForIssuer(issuerUrl: string, rpName = "LAX"): PasskeyConfig {
  const url = new URL(issuerUrl);
  return { rpID: url.hostname, origin: url.origin, rpName };
}

function refuseWrongPerson(): never {
  throw new APIError("FORBIDDEN", {
    message: "That passkey belongs to a different account from the one you are signed in to.",
    code: PASSKEY_WRONG_PERSON,
  });
}

function refuseUnverified(): never {
  throw new APIError("FORBIDDEN", {
    message:
      "Your device didn't confirm it's you, so the passkey wasn't used. Use a device with a screen lock, or a password manager that asks for one.",
    code: PASSKEY_USER_VERIFICATION_REQUIRED,
  });
}

/**
 * Better Auth's passkey plugin, closed in the three places it is open by default (SM17):
 *
 *  - the origin and relying party are the issuer's, from configuration;
 *  - the device must check the person (face, fingerprint, screen lock): it is asked for at
 *    creation, and because the plugin itself verifies with `requireUserVerification: false`, a
 *    response whose user-verified flag is not set is refused in the after-verification hooks, in
 *    both creation (before the passkey is stored) and sign-in (before a session exists);
 *  - the credential is a discoverable one, so signing in needs no email first;
 *  - a browser that is signed in as one person is refused another person's passkey.
 *
 * Better Auth's list, rename and delete endpoints are switched off (see
 * `DISABLED_AUTH_ENDPOINT_PATHS`): naming and removal go through LAX Account's own routes, which
 * check the last-method rule and end other sessions. Creation is gated by the issuer's one-time
 * hand-off in the request handler, not here.
 */
export function buildPasskeyPlugin(config: PasskeyConfig, ports: PasskeyPorts): BetterAuthPlugin {
  return passkey({
    rpID: config.rpID,
    rpName: config.rpName,
    origin: config.origin,
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    // The table's column is `credential_id`; the plugin calls the field `credentialID`.
    schema: { passkey: { fields: { credentialID: "credentialId" } } },
    registration: {
      afterVerification: async ({ ctx, verification }) => {
        if (verification.registrationInfo?.userVerified !== true) refuseUnverified();
        return {
          name: suggestPasskeyName({
            aaguid: verification.registrationInfo.aaguid,
            userAgent: ctx.headers?.get("user-agent"),
          }),
        };
      },
    },
    authentication: {
      afterVerification: async ({ ctx, verification, clientData }) => {
        if (verification.authenticationInfo?.userVerified !== true) refuseUnverified();
        // A browser that is already signed in is confirming it is that person (a "Confirm it's
        // you" sign-in): a passkey that belongs to someone else must not pass for them, and must
        // not quietly sign the browser in as that other person.
        const current = await getSessionFromCtx(ctx);
        if (current?.user?.id) {
          const owner = await ctx.context.adapter.findOne<{ userId: string }>({
            model: "passkey",
            where: [{ field: "credentialID", value: clientData.id }],
          });
          if (owner && owner.userId !== current.user.id) refuseWrongPerson();
        }
        await ports.markUsed(clientData.id);
      },
    },
  });
}
