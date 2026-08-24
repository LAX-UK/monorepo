import "server-only";
import { resolveRolloutFlag } from "@/lib/rollout/resolve-rollout-flag.server";

/**
 * Enabled by default outside production so behavior can be verified before the
 * production cohort is explicitly switched on.
 */
export function areMarketingPromptsEnabled(): boolean {
  return resolveRolloutFlag("MARKETING_PROMPTS_ENABLED", process.env.NODE_ENV !== "production");
}
