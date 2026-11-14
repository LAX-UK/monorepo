import {
  STEP_UP_COMPLETE_HEADERS,
  stepUpAnswerFromSearch,
  stepUpCompleteHtml,
} from "@/lib/step-up-complete";

export const dynamic = "force-dynamic";

/** Where the "Confirm it's you" window lands after the issuer confirms the person. */
export function GET(request: Request): Response {
  const answer = stepUpAnswerFromSearch(new URL(request.url).searchParams);
  return new Response(stepUpCompleteHtml(answer), {
    headers: { ...STEP_UP_COMPLETE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
