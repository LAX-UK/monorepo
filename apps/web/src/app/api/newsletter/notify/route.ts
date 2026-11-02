import { forwardNewsletterSubscribe } from "@/lib/data/http/newsletter-subscribe.server";
import {
  COVER_ALERTS_PARAM,
  type CoverAlertsOutcome,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { newsletterSubscribeSchema } from "@auction/validators";
import { NextResponse } from "next/server";

/** Sends the visitor home with the outcome, so the sign-up works without script. */
function backHome(req: Request, outcome: CoverAlertsOutcome): NextResponse {
  const url = new URL("/", req.url);
  url.searchParams.set(COVER_ALERTS_PARAM, outcome);
  return NextResponse.redirect(url, 303);
}

/** The email field on the home cover posts here as a plain form. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const parsed = newsletterSubscribeSchema.safeParse({
    email: form?.get("email"),
    source: "web_home_cover",
  });
  if (!parsed.success) return backHome(req, "invalid");
  const res = await forwardNewsletterSubscribe(parsed.data);
  return backHome(req, res.ok ? "subscribed" : "failed");
}
