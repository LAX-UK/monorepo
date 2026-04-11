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
          defaultValue: "buyer",
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
  });
}

export type Auth = ReturnType<typeof createAuth>;
