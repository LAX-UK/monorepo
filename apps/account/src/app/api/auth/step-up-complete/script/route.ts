import {
  STEP_UP_COMPLETE_HEADERS,
  stepUpAnswerFromSearch,
  stepUpCompleteScript,
} from "@/lib/step-up-complete";

export const dynamic = "force-dynamic";

/** The completion page's script, from Account's own origin so the page needs no inline script. */
export function GET(request: Request): Response {
  const answer = stepUpAnswerFromSearch(new URL(request.url).searchParams);
  return new Response(stepUpCompleteScript(answer), {
    headers: {
      ...STEP_UP_COMPLETE_HEADERS,
      "Content-Type": "text/javascript; charset=utf-8",
    },
  });
}
