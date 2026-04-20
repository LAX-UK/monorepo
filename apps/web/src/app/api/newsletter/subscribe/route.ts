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

  await new Promise((r) => setTimeout(r, 250));

  return NextResponse.json({ ok: true });
}
