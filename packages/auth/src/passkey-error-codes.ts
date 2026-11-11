/**
 * The error codes the issuer's passkey endpoints answer with, written once for both sides: the
 * server throws them and the hosted pages read them. This file imports nothing, so the browser
 * bundle can use it without pulling in the server.
 */

/** A browser signed in as one person was given another person's passkey. */
export const PASSKEY_WRONG_PERSON = "passkey_wrong_person";

/** The device did not check the person (face, fingerprint, screen lock). */
export const PASSKEY_USER_VERIFICATION_REQUIRED = "passkey_user_verification_required";

/** The person already holds the most passkeys an account can have. */
export const PASSKEY_LIMIT_ERROR_CODE = "passkey_limit";

/** Making a passkey needs the one-time hand-off, and the browser does not hold it. */
export const PASSKEY_NOT_ALLOWED = "passkey_enrolment_not_allowed";

/** Codes Better Auth's passkey plugin uses for the cases the pages word themselves. */
export const PLUGIN_PASSKEY_NOT_FOUND = "PASSKEY_NOT_FOUND";
export const PLUGIN_CHALLENGE_NOT_FOUND = "CHALLENGE_NOT_FOUND";
