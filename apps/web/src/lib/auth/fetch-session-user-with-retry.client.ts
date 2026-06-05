import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import type { SessionUser } from "@/lib/data/contracts";

const RETRY_DELAY_MS = 400;

/** Fetch `/users/me` after auth; one retry handles cookie-cache propagation lag. */
export async function fetchSessionUserWithRetry(): Promise<SessionUser | null> {
  let me = await fetchSessionUserAfterAuth();
  if (!me) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    me = await fetchSessionUserAfterAuth();
  }
  return me;
}

export const POST_AUTH_SESSION_LOAD_ERROR =
  "Your session could not be loaded. Please try signing in again.";
