import { isIdentityRejected } from "@auction/identity-rp";

export type AdminReadFailure =
  | { kind: "unauthorized" }
  | { kind: "failed"; log: { name: string; message: string; oauthError?: string } };

/**
 * Classifies an error thrown while forwarding a server-side admin read. A session the BFF can no
 * longer use (its Redis record expired or was cleared, or Auth rejected the refresh or the Shop API
 * token exchange) must send staff back through sign-in, not render a 500. Anything else is a real
 * failure; the returned log fields carry no tokens so they are safe to write to the server log.
 */
export function classifyAdminReadFailure(error: unknown): AdminReadFailure {
  if (error instanceof Error && error.message === "Unauthorized") {
    return { kind: "unauthorized" };
  }
  if (isIdentityRejected(error)) {
    return { kind: "unauthorized" };
  }
  if (error instanceof Error) {
    const oauthError = (error as { oauthError?: unknown }).oauthError;
    return {
      kind: "failed",
      log: {
        name: error.name,
        message: error.message,
        ...(typeof oauthError === "string" ? { oauthError } : {}),
      },
    };
  }
  return { kind: "failed", log: { name: "UnknownError", message: String(error) } };
}
