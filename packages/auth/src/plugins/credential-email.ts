import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";
import type { CredentialEmailInput, CredentialEmailSender } from "../ports/email-sender.js";

/** Returned to the hosted pages, which show the matching message. */
export const EMAIL_SEND_FAILED_CODE = "EMAIL_SEND_FAILED";
export const EMAIL_SEND_FAILED_MESSAGE = "We couldn't send the email. Try again.";

/**
 * One key per template and token. The token is hashed so the key can be stored and logged
 * without being usable as a link, and so a retry of the same request reaches the same message.
 */
export function credentialEmailKey(template: string, token: string): string {
  return `${template}:${createHash("sha256").update(token).digest("hex")}`;
}

export type CredentialEmailRequest = Omit<CredentialEmailInput, "idempotencyKey" | "category"> & {
  token: string;
};

/**
 * Sends an email that carries a one-time link and waits for it to be queued or recorded for
 * retry. When neither happened the request fails, so the person is never told a link was sent
 * when it was not. The cause is deliberately not attached: it may describe the link.
 */
export async function sendCredentialEmail(
  sender: CredentialEmailSender | undefined,
  { token, ...input }: CredentialEmailRequest,
): Promise<void> {
  if (!sender) return;
  try {
    await sender.send({
      ...input,
      category: "auth",
      idempotencyKey: credentialEmailKey(input.template, token),
    });
  } catch {
    throw new APIError("SERVICE_UNAVAILABLE", {
      code: EMAIL_SEND_FAILED_CODE,
      message: EMAIL_SEND_FAILED_MESSAGE,
    });
  }
}
