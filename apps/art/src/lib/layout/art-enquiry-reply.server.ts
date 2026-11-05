import { isEnquiryReplyWaiting } from "@/lib/account/account-enquiries.vm";
import { artServices } from "@/lib/art-services.server";
import type { ArtPortalReadPort } from "@/lib/ports";
import type { AccountChromeState } from "@auction/lax-ecosystem";
import { cache } from "react";

/** The chrome must not wait on the enquiry read for long; no answer in time means no dot. */
export const ENQUIRY_REPLY_TIMEOUT_MS = 1500;

/**
 * Whether a signed-in visitor has an enquiry the gallery has replied to, for the dot on Account.
 * Signed-out visitors, failed reads and slow reads all give false: the dot is a courtesy, never
 * a reason to hold up or break a page.
 */
export async function composeArtEnquiryReplyDot(
  account: AccountChromeState,
  portal: Pick<ArtPortalReadPort, "listEnquiries">,
  timeoutMs = ENQUIRY_REPLY_TIMEOUT_MS,
): Promise<boolean> {
  if (account.kind !== "authenticated") return false;
  const read = portal
    .listEnquiries()
    .then(
      (result) =>
        result.status === "ok" && result.data.some((row) => isEnquiryReplyWaiting(row.status)),
    )
    .catch(() => false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const loadArtEnquiryReplyDot = cache((account: AccountChromeState) =>
  composeArtEnquiryReplyDot(account, artServices.portal),
);
