import { forwardNewsletterSubscribe } from "@/lib/data/http/newsletter-subscribe.server";
import { newsletterSubscribeSchema } from "@auction/validators";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = newsletterSubscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const res = await forwardNewsletterSubscribe({
    ...parsed.data,
    source: parsed.data.source ?? "web_newsletter_form",
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, message: "We couldn't subscribe you right now. Please try again." },
      { status: 502 },
    );
  }

  const body = (await res.json().catch(() => ({}))) as { status?: string };
  return NextResponse.json({ ok: true, status: body.status ?? "subscribed" });
}
