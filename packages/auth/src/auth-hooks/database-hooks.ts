import { buildAccountDatabaseHooks } from "./account-hooks.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { buildSessionDatabaseHooks } from "./session-hooks.js";
import { buildUserDatabaseHooks } from "./user-hooks.js";

export function buildDatabaseHooks(deps: AuthHookDeps) {
  return {
    user: buildUserDatabaseHooks(deps),
    session: buildSessionDatabaseHooks(deps),
    account: buildAccountDatabaseHooks(deps),
  };
}
