import { buildValidationFailedBody } from "@auction/validators";
import { type Hook, zValidator as zValidatorBase } from "@hono/zod-validator";
import type { Env, ValidationTargets } from "hono";
import type { ZodSchema } from "zod";

/** Drop-in {@link zValidatorBase} that returns `{ error, errorCode }` on validation failure. */
export function zValidator<
  T extends ZodSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
>(target: Target, schema: T, hook?: Hook<unknown, E, P, Target>) {
  return zValidatorBase<T, Target, E, P>(target, schema, async (result, c) => {
    if (hook) {
      const hookResult = await hook(result, c);
      if (hookResult) return hookResult;
    }
    if (!result.success) {
      return c.json(buildValidationFailedBody(result.error), 400);
    }
  });
}
