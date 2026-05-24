import { z } from "zod";

export type AutoBidLotRules = {
  autoBidEnabled?: boolean | undefined;
  minBidIncrement: string;
  autoBidStepMin?: string | null | undefined;
  autoBidStepMax?: string | null | undefined;
  autoBidStepPresets?: number[] | null | undefined;
};

function parsePositive(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Effective step bounds for buyer UI and validation. */
export function resolveAutoBidStepBounds(rules: AutoBidLotRules): {
  min: number;
  max: number;
  presets: number[] | null;
} {
  const lotMin = parsePositive(rules.minBidIncrement) ?? 0.01;
  const stepMin = parsePositive(rules.autoBidStepMin) ?? lotMin;
  const stepMax = parsePositive(rules.autoBidStepMax) ?? stepMin;
  const min = Math.max(lotMin, stepMin);
  const max = Math.max(min, stepMax);
  const presets = rules.autoBidStepPresets?.filter((n) => Number.isFinite(n) && n > 0) ?? null;
  if (presets && presets.length > 0) {
    const filtered = presets.filter((n) => n + 1e-9 >= min && n <= max + 1e-9);
    return { min, max, presets: filtered.length > 0 ? filtered : null };
  }
  return { min, max, presets: null };
}

/** Returns allowed step options for buyer chips (presets or generated range). */
export function listAllowedAutoBidSteps(rules: AutoBidLotRules, maxOptions = 8): number[] {
  const { min, max, presets } = resolveAutoBidStepBounds(rules);
  if (presets?.length) return [...presets].sort((a, b) => a - b);
  if (min >= max - 1e-9) return [min];
  const steps: number[] = [];
  for (let v = min; v <= max + 1e-9 && steps.length < maxOptions; v += min) {
    steps.push(Number(v.toFixed(2)));
  }
  if (steps.length === 0) steps.push(min);
  const lastStep = steps[steps.length - 1] ?? min;
  if (lastStep < max - 1e-9) steps.push(Number(max.toFixed(2)));
  return steps;
}

export function validateAutoBidStepAmount(rules: AutoBidLotRules, step: number): string | null {
  if (rules.autoBidEnabled === false) {
    return "Auto-bid is not enabled for this lot";
  }
  if (!Number.isFinite(step) || step <= 0) {
    return "Auto-bid step must be a positive amount";
  }
  const { min, max, presets } = resolveAutoBidStepBounds(rules);
  if (presets?.length) {
    const hit = presets.some((p) => Math.abs(p - step) < 1e-9);
    if (!hit) return `Choose a step of ${presets.map((p) => p.toFixed(2)).join(", ")}`;
    return null;
  }
  if (step + 1e-9 < min) {
    return `Auto-bid step must be at least ${min.toFixed(2)}`;
  }
  if (step > max + 1e-9) {
    return `Auto-bid step must be at most ${max.toFixed(2)}`;
  }
  return null;
}

export const setAutoBidBodySchema = z
  .object({
    maxAutoBidAmount: z.number().positive().finite(),
    autoBidStepAmount: z.number().positive().finite(),
  })
  .strict();

export type SetAutoBidBody = z.infer<typeof setAutoBidBodySchema>;

export const lotIdAutoBidParamSchema = z.object({
  lotId: z.string().uuid(),
});
