import { forwardVisitorAlertSignup } from "@/lib/data/http/sale-alerts.server";
import {
  COVER_ALERTS_PARAM,
  type CoverAlertsOutcome,
  HOME_ALERTS_ANCHOR,
  parseAlertSignupSource,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { visitorAlertSignupSchema } from "@auction/validators";
import { NextResponse } from "next/server";

/** Sends the visitor back to the alerts band with the outcome, so the sign-up works without script. */
function backToBand(req: Request, outcome: CoverAlertsOutcome): NextResponse {
  const url = new URL("/", req.url);
  url.searchParams.set(COVER_ALERTS_PARAM, outcome);
  url.hash = HOME_ALERTS_ANCHOR;
  return NextResponse.redirect(url, 303);
}

/** The email fields on the home page post here as plain forms. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const parsed = visitorAlertSignupSchema.safeParse({
    email: form?.get("email"),
    source: parseAlertSignupSource(form?.get("source")),
  });
  if (!parsed.success) return backToBand(req, "invalid");
  const res = await forwardVisitorAlertSignup({
    email: parsed.data.email,
    source: parsed.data.source ?? "web_home_cover",
  });
  if (res.status === 429) return backToBand(req, "limited");
  return backToBand(req, res.ok ? "submitted" : "failed");
}
