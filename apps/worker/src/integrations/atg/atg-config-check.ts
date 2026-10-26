import type { AtgGateway } from "./atg-gateway.js";
import type { AtgSyncConfig } from "./atg-types.js";

export type AtgConfigCheckResult = {
  /** Configured values ATG does not know; pushes will fail until fixed. */
  problems: string[];
  /** Checks that could not run (ATG unreachable, no client id); nothing is known either way. */
  unavailable: string[];
};

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Compares the configured increment set and default category with what ATG offers, so a wrong
 * value is reported at startup instead of as a failed first push. Never throws.
 */
export async function checkAtgConfig(
  gateway: AtgGateway,
  config: AtgSyncConfig,
): Promise<AtgConfigCheckResult> {
  const result: AtgConfigCheckResult = { problems: [], unavailable: [] };

  if (config.clientId) {
    try {
      const sets = await gateway.getIncrementSets(config.clientId);
      const wanted = config.incrementSetId.toLowerCase();
      if (!sets.some((set) => set.incrementSetId.toLowerCase() === wanted)) {
        result.problems.push(
          `ATG_INCREMENT_SET_ID ${config.incrementSetId} is not one of the client's increment sets (${sets.map((s) => s.incrementSetId).join(", ") || "none"}).`,
        );
      }
    } catch (err) {
      result.unavailable.push(`Increment sets could not be checked: ${reason(err)}`);
    }
  } else {
    result.unavailable.push("Increment set not checked: ATG_CLIENT_ID is not set.");
  }

  try {
    const categories = await gateway.getSupportedCategories(config.platformCode);
    if (!categories.includes(config.defaultCategory)) {
      result.problems.push(
        `ATG_DEFAULT_CATEGORY "${config.defaultCategory}" is not a supported category on platform ${config.platformCode} (${categories.join(", ") || "none"}).`,
      );
    }
  } catch (err) {
    result.unavailable.push(`Supported categories could not be checked: ${reason(err)}`);
  }

  return result;
}
