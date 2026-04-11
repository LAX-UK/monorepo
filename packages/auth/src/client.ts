import { createAuthClient } from "better-auth/client";

export function createAuthClientInstance(options: { baseURL: string }) {
  return createAuthClient({
    baseURL: options.baseURL,
  });
}
