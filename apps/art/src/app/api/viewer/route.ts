import { loadArtAccountChromeState } from "@/lib/ecosystem/art-account-chrome.server";
import { loadArtEnquiryReplyDot } from "@/lib/layout/art-enquiry-reply.server";
import {
  ART_VIEWER_RESPONSE_HEADERS,
  type ArtViewerChromeSnapshot,
} from "@/lib/viewer/art-viewer-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The visitor's account chrome, read by the browser. The root layout draws a guest so its HTML can
 * be shared between visitors; this answer then redraws the header, bottom bar and footer.
 */
export async function GET() {
  const account = await loadArtAccountChromeState().catch(
    (): ArtViewerChromeSnapshot["account"] => ({
      kind: "unavailable",
      message: "Account status is unavailable.",
    }),
  );
  const body: ArtViewerChromeSnapshot = {
    account,
    replyDot: await loadArtEnquiryReplyDot(account),
  };
  return NextResponse.json(body, { headers: ART_VIEWER_RESPONSE_HEADERS });
}
