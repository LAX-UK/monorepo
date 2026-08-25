import { existsSync } from "node:fs";
import {
  formatProbeFailure,
  probeStorageStateFile,
} from "../../../scripts/ci/e2e-session-state.mjs";
import { roleAuthState } from "./helpers/auth-state";

/** Fails the suite before the first spec if a prepared role cookie is already dead. */
export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_E2E !== "1") return;
  if (process.env.PLAYWRIGHT_AUTH_PREPARED !== "1") return;

  if (!existsSync(roleAuthState.staff)) {
    throw new Error(
      `PLAYWRIGHT_AUTH_PREPARED=1 but ${roleAuthState.staff} is missing. Run node scripts/ci/prepare-e2e-auth-states.mjs`,
    );
  }

  for (const [role, filePath] of Object.entries(roleAuthState)) {
    if (!existsSync(filePath)) continue;
    const probe = await probeStorageStateFile(filePath);
    if (!probe.authenticated) {
      throw new Error(formatProbeFailure(role, filePath, probe));
    }
  }
}
