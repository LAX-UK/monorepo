import { dropAdminFlash } from "@/lib/admin/flash/flash.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Called by the page once it has shown a flash message, so the message is not shown again on a
 * reload. A cookie cannot be removed while a page renders, hence this separate call.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const dropped = await dropAdminFlash(path);
  return new NextResponse(null, { status: dropped ? 204 : 400 });
}
