import { createServerClientIpResolver } from "@auction/http-headers/client-ip";
import { buildRateLimitedMessage } from "../domain/data-export.vm";
import type { IdentityActor } from "../ports/account-identity-gateway";
import type { DataExportClient, DataExportGateway } from "../ports/data-export-gateway";

const UNAVAILABLE_MESSAGE =
  "We couldn't do that just now. Nothing was changed. Please try again in a moment.";

/** What asking for a copy tells the page. A failure is never reported as a request. */
export type RequestDataExportResult =
  | { status: "requested" }
  | { status: "already_open" }
  | { status: "limited"; message: string }
  | { status: "reauth_required" }
  | { status: "error"; message: string };

export type DeleteDataExportResult =
  | { status: "deleted" }
  | { status: "reauth_required" }
  | { status: "error"; message: string };

export type DataExportCommandDeps = {
  dataExports: Pick<DataExportGateway, "request" | "deleteCopy" | "download">;
  loadActor: () => Promise<IdentityActor | "no_session" | "unavailable">;
  client: () => Promise<DataExportClient>;
};

/**
 * Asks for a copy as the signed-in person. No session means a fresh sign-in; a session store
 * that cannot be reached means nothing was asked. Identity decides whether the sign-in is recent
 * enough, so the page being out of date can never create a request by itself.
 */
export async function requestDataExport(
  deps: DataExportCommandDeps,
): Promise<RequestDataExportResult> {
  const actor = await deps.loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return { status: "error", message: UNAVAILABLE_MESSAGE };
  const result = await deps.dataExports.request(actor, await deps.client());
  if (result.status === "reauth_required") return result;
  if (result.status !== "ok") return { status: "error", message: UNAVAILABLE_MESSAGE };
  switch (result.value.outcome) {
    case "requested":
      return { status: "requested" };
    case "already_open":
      return { status: "already_open" };
    case "rate_limited":
      return { status: "limited", message: buildRateLimitedMessage(result.value.retryAfter) };
  }
}

/** Deletes the copy early. A copy that is already gone counts as deleted: that is what was asked. */
export async function deleteDataExportCopy(
  deps: Pick<DataExportCommandDeps, "dataExports" | "loadActor">,
  exportId: string,
): Promise<DeleteDataExportResult> {
  const id = exportId.trim();
  if (!id) return { status: "error", message: UNAVAILABLE_MESSAGE };
  const actor = await deps.loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return { status: "error", message: UNAVAILABLE_MESSAGE };
  const result = await deps.dataExports.deleteCopy(actor, id);
  switch (result.status) {
    case "ok":
    case "gone":
      return { status: "deleted" };
    case "reauth_required":
      return result;
    case "unavailable":
      return { status: "error", message: UNAVAILABLE_MESSAGE };
  }
}

const resolveVisitorIp = createServerClientIpResolver();

/**
 * Where the person's browser came from: the address the platform resolved, never the first
 * forwarded entry, which the browser chooses. Recorded as audit evidence.
 */
export function dataExportClientFromHeaders(headers: Pick<Headers, "get">): DataExportClient {
  const ip = resolveVisitorIp(headers);
  return {
    ip: ip === "unknown" ? null : ip,
    userAgent: headers.get("user-agent")?.trim() || null,
  };
}

export type DownloadDataExportResult =
  | { status: "signed"; url: string }
  | { status: "reauth_required" }
  | { status: "gone" }
  | { status: "error" };

/**
 * Gets the one-time link for the person's copy. Identity re-checks the sign-in on every call,
 * so a link is never issued from an old sign-in or from a copy that has expired.
 */
export async function signDataExportDownload(
  deps: Pick<DataExportCommandDeps, "dataExports" | "loadActor" | "client">,
  exportId: string,
): Promise<DownloadDataExportResult> {
  const id = exportId.trim();
  if (!id) return { status: "gone" };
  const actor = await deps.loadActor();
  if (actor === "no_session") return { status: "reauth_required" };
  if (actor === "unavailable") return { status: "error" };
  const result = await deps.dataExports.download(actor, id, await deps.client());
  switch (result.status) {
    case "ok":
      return { status: "signed", url: result.value.url };
    case "reauth_required":
    case "gone":
      return { status: result.status };
    case "unavailable":
      return { status: "error" };
  }
}
