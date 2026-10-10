import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BreachedPasswordChecker } from "./ports/breached-password-checker.js";

const PASSWORD_PATHS = new Set([
  "/sign-up/email",
  "/change-password",
  "/reset-password",
  "/set-password",
]);

function passwordFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["newPassword", "password"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function buildBreachedPasswordPlugin(checker?: BreachedPasswordChecker): BetterAuthPlugin {
  if (!checker) {
    return { id: "breached-password-check-disabled", hooks: {} };
  }
  return {
    id: "breached-password-check",
    hooks: {
      before: [
        {
          matcher: (ctx) => PASSWORD_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const password = passwordFromBody(ctx.body);
            if (!password) return;
            const result = await checker.checkPassword(password);
            if (result.status === "breached") {
              throw new APIError("BAD_REQUEST", {
                message: "PASSWORD_BREACHED",
                code: "PASSWORD_BREACHED",
              });
            }
          }),
        },
      ],
    },
  };
}
