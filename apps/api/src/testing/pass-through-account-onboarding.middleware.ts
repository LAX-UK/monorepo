import { createMiddleware } from "hono/factory";

/** Test/dev no-op when onboarding gate is wired at the app composition root. */
export const passThroughAccountOnboarding = createMiddleware(async (_c, next) => {
  await next();
});
