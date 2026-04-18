import type { Database } from "@auction/db";
import { account, session, user, verification } from "@auction/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export type AuthEnv = {
  db: Database;
  secret: string;
  /** e.g. http://localhost:3001 */
  baseURL: string;
  trustedOrigins?: string[] | undefined;
  /** Set to true to allow cookies over HTTP (non-HTTPS). Only for testing! */
  allowInsecureCookies?: boolean;
};

export function createAuth(env: AuthEnv) {
  return betterAuth({
    secret: env.secret,
    baseURL: env.baseURL,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(env.db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      // Allow cookies over HTTP when explicitly enabled (for testing without HTTPS)
      useSecureCookies: env.allowInsecureCookies ? false : undefined,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
