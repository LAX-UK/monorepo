import { createAuthClient } from "better-auth/client";

const baseURL =
  process.env.NEXT_PUBLIC_AUTH_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

/** Points at the canonical auth issuer; Better Auth uses `/api/auth` routes on that host. */
export const authClient = createAuthClient({
  baseURL,
}) as ReturnType<typeof createAuthClient>;
