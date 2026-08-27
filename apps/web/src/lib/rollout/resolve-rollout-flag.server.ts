import "server-only";

import { parseBooleanFlag } from "@/lib/rollout/parse-boolean-flag";

export function resolveRolloutFlag(name: string, fallback: boolean): boolean {
  const configured = parseBooleanFlag(process.env[name]);
  return configured ?? fallback;
}
