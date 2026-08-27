import { existsSync, readFileSync } from "node:fs";
import { roleAuthState } from "./helpers/auth-state";

function assertStateHasSessionToken(role: string, filePath: string): void {
  const state = JSON.parse(readFileSync(filePath, "utf8")) as {
    cookies?: Array<{ name: string }>;
  };
  const hasToken = (state.cookies ?? []).some((cookie) => /session_token/.test(cookie.name));
  if (!hasToken) {
    throw new Error(
      `Prepared auth state "${role}" has no session_token cookie (${filePath}). Re-run node scripts/ci/prepare-e2e-auth-states.mjs`,
    );
  }
}

/**
 * Fail fast on missing/empty prepared files. Live get-session probes stay in
 * the mint script so this hook does not burn the auth general rate-limit bucket.
 */
export default function globalSetup(): void {
  if (process.env.PLAYWRIGHT_E2E !== "1") return;
  if (process.env.PLAYWRIGHT_AUTH_PREPARED !== "1") return;

  if (!existsSync(roleAuthState.staff)) {
    throw new Error(
      `PLAYWRIGHT_AUTH_PREPARED=1 but ${roleAuthState.staff} is missing. Run node scripts/ci/prepare-e2e-auth-states.mjs`,
    );
  }

  for (const [role, filePath] of Object.entries(roleAuthState)) {
    if (!existsSync(filePath)) continue;
    assertStateHasSessionToken(role, filePath);
  }
}
