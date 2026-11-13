import "server-only";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { NextResponse } from "next/server";
import { z } from "zod";

const linkSchema = z.object({ data: z.object({ url: z.string().url() }) });

/**
 * Sends the browser to a lot's signed agreement PDF. The API checks the person may handle
 * agreements and signs a link that works for one minute, so the link is made at the click and
 * never sits in a page. Anything else answers with a plain status: nothing about the file leaks.
 */
export async function openSignedAgreement(lotId: string): Promise<Response> {
  const res = await authedServerFetch(
    `/admin/seller-proceeds/lots/${encodeURIComponent(lotId)}/signed-agreement/document`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const status =
      res.status === 401 || res.status === 403 || res.status === 404 ? res.status : 502;
    return new NextResponse(
      status === 404
        ? "There is no signed agreement on record for this lot."
        : "The signed agreement could not be opened.",
      {
        status,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
  const parsed = linkSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success || !/^https?:/.test(parsed.data.data.url)) {
    return new NextResponse("The signed agreement could not be opened.", { status: 502 });
  }
  const redirect = NextResponse.redirect(parsed.data.data.url, 302);
  redirect.headers.set("Cache-Control", "no-store");
  redirect.headers.set("Referrer-Policy", "no-referrer");
  return redirect;
}
