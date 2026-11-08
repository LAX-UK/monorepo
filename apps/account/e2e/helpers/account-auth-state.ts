import path from "node:path";
import { fileURLToPath } from "node:url";

const authDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".auth");

/**
 * Where the setup project saves each signed-in browser state. Specs reuse these instead of
 * signing in again, so a run makes two hosted sign-ins however many tests it holds.
 */
export const accountAuthState = {
  collector: path.join(authDir, "collector.json"),
  newPerson: path.join(authDir, "new-person.json"),
} as const;

/** A signed-out browser, for the specs that exercise sign-in itself. */
export const signedOutState = { cookies: [], origins: [] };
