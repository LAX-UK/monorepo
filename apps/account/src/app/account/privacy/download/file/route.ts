import {
  dataExportClientFromHeaders,
  signDataExportDownload,
} from "@/server/application/data-export-commands";
import { loadActor } from "@/server/application/load-account-actor";
import { getLaxAccountContainer } from "@/server/container";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  DATA_EXPORT_PROBLEM_PARAM,
  DATA_EXPORT_ROUTE,
  dataExportReturnTo,
} from "@/server/domain/data-export-routes";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Starts the download of the person's copy. Pressing Download posts here; Identity re-checks the
 * sign-in and returns a link that lasts a few minutes, and the browser is sent straight to it
 * (303), so the file never passes through Account. An old sign-in goes through the hosted
 * re-sign-in and comes back to the page, which presses Download again once. A second refusal in
 * that round trip is reported, never looped.
 */
export async function POST(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  const origin = container.config.publicOrigin;
  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const id = form?.get("id");
  const resumed = form?.get("resumed") === "1";
  const back = (problem?: string) => {
    const url = new URL(DATA_EXPORT_ROUTE, origin);
    if (problem) url.searchParams.set(DATA_EXPORT_PROBLEM_PARAM, problem);
    return NextResponse.redirect(url, 303);
  };

  const result = await signDataExportDownload(
    {
      dataExports: container.dataExports,
      loadActor,
      client: async () => dataExportClientFromHeaders(request.headers),
    },
    typeof id === "string" ? id : "",
  );
  switch (result.status) {
    case "signed": {
      const response = NextResponse.redirect(result.url, 303);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    case "reauth_required":
      if (resumed) return back("step_up_failed");
      return NextResponse.redirect(
        new URL(buildReauthHref(dataExportReturnTo("download")), origin),
        303,
      );
    case "gone":
      return back();
    case "error":
      return back("download_unavailable");
  }
}
