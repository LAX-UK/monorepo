import {
  applicationIdParam,
  checkApplicationImage,
  isSameOriginRequest,
} from "@/lib/artist-application/artist-application-upload";
import { artistApplicationGateway } from "@/lib/artist-application/artist-application.services.server";
import { publicRequestHost } from "@/lib/seo/art-indexing";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function refuse(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Takes one image from the application form and adds it to the artist's application: the first
 * image starts the application. The file is checked here, again by the API, and once more when
 * the stored bytes are probed.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers, publicRequestHost(request.headers))) {
    return refuse(403, "This upload did not come from lax.art.");
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return refuse(400, "Choose an image to upload.");
  const check = checkApplicationImage(file);
  if (!check.ok) return refuse(400, check.message);

  let id = applicationIdParam(form.get("applicationId"));
  if (!id) {
    const started = await artistApplicationGateway.start();
    if (started.kind === "signed_out") return refuse(401, "Sign in again to upload images.");
    if (started.kind !== "ok") return refuse(502, "We could not upload that image. Try again.");
    id = started.value.id;
  }

  const result = await artistApplicationGateway.uploadImage(id, {
    bytes: await file.arrayBuffer(),
    contentType: file.type,
  });
  switch (result.kind) {
    case "ok":
      return NextResponse.json({ ok: true, application: result.value });
    case "signed_out":
      return refuse(401, "Sign in again to upload images.");
    case "refused":
      return refuse(result.status, result.message);
    case "unavailable":
      return refuse(502, `We could not upload ${file.name}. Try again.`);
  }
}
