import { STEP_UP_COMPLETE_HEADERS, stepUpCompleteHtml } from "@/lib/step-up-complete";

export const dynamic = "force-dynamic";

/** Where the "Confirm it's you" window lands after the issuer confirms the person. */
export function GET(): Response {
  return new Response(stepUpCompleteHtml(), {
    headers: { ...STEP_UP_COMPLETE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
