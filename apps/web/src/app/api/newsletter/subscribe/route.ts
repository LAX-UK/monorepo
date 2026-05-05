import { apiBaseUrl } from "@/lib/auth/api-base";
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

  const res = await fetch(`${apiBaseUrl()}/newsletter/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...parsed.data, source: parsed.data.source ?? "web_newsletter_form" }),
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, message: "We couldn't subscribe you right now. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
