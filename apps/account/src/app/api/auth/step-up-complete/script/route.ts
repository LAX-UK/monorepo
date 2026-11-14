import { STEP_UP_COMPLETE_HEADERS, STEP_UP_COMPLETE_SCRIPT } from "@/lib/step-up-complete";

export const dynamic = "force-dynamic";

/** The completion page's script, from Account's own origin so the page needs no inline script. */
export function GET(): Response {
  return new Response(STEP_UP_COMPLETE_SCRIPT, {
    headers: {
      ...STEP_UP_COMPLETE_HEADERS,
      "Content-Type": "text/javascript; charset=utf-8",
    },
  });
}
