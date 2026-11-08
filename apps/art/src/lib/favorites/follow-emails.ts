import type { ArtCommerceMutationClient } from "@/lib/art-commerce-mutation.server";

export const FOLLOW_EMAILS_TOPIC = "art.followed_artists";
export const FOLLOW_EMAILS_PATH = "/commerce/me/email-alerts";

/**
 * Whether emails about followed artists are on, from the alert switches Shop reports. Null when
 * the answer is missing or off-contract, so the page says nothing rather than guessing.
 */
export function readFollowEmailsOn(body: unknown): boolean | null {
  const topics = (body as { topics?: unknown } | null)?.topics;
  if (!Array.isArray(topics)) return null;
  const entry = topics.find(
    (candidate: { topic?: unknown }) => candidate?.topic === FOLLOW_EMAILS_TOPIC,
  ) as { emailOn?: unknown } | undefined;
  return typeof entry?.emailOn === "boolean" ? entry.emailOn : null;
}

/**
 * Whether the person stopped all alerts, as Shop reports it for this topic. False when the answer
 * is missing, so nothing is said about it rather than guessed.
 */
export function readFollowEmailsStopped(body: unknown): boolean {
  const topics = (body as { topics?: unknown } | null)?.topics;
  if (!Array.isArray(topics)) return false;
  const entry = topics.find(
    (candidate: { topic?: unknown }) => candidate?.topic === FOLLOW_EMAILS_TOPIC,
  ) as { stopped?: unknown } | undefined;
  return entry?.stopped === true;
}

export type TurnOnFollowEmailsOutcome = { ok: true } | { ok: false; message: string };

const REFUSALS: Record<string, string> = {
  unverified: "Verify your email address in LAX Account to get these emails.",
  blocked: "Emails to this address were stopped. Contact us to switch them back on.",
};

/** Switches emails about followed artists back on, as the signed-in person. */
export async function turnOnFollowEmails(
  client: ArtCommerceMutationClient,
): Promise<TurnOnFollowEmailsOutcome> {
  const result = await client.mutate(`${FOLLOW_EMAILS_PATH}/topics/${FOLLOW_EMAILS_TOPIC}`, {
    method: "PUT",
    body: { on: true },
  });
  if (result.kind === "csrf_unavailable") {
    return { ok: false, message: "Your session expired. Refresh the page and try again." };
  }
  if (result.kind === "response" && result.status >= 200 && result.status < 300)
    return { ok: true };
  if (result.kind === "response" && result.status === 401) {
    return { ok: false, message: "Sign in to change your emails." };
  }
  if (result.kind === "response" && result.status === 409) {
    const reason = (result.body as { reason?: unknown } | null)?.reason;
    const message = typeof reason === "string" ? REFUSALS[reason] : undefined;
    if (message) return { ok: false, message };
  }
  return { ok: false, message: "We couldn't turn emails on just now. Try again shortly." };
}
