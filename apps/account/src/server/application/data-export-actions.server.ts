"use server";

import { headers } from "next/headers";
import { getLaxAccountContainer } from "../container";
import {
  type DeleteDataExportResult,
  type RequestDataExportResult,
  dataExportClientFromHeaders,
  deleteDataExportCopy,
  requestDataExport,
} from "./data-export-commands";
import { loadActor } from "./load-account-actor";

function deps() {
  return {
    dataExports: getLaxAccountContainer().dataExports,
    loadActor,
    client: async () => dataExportClientFromHeaders(await headers()),
  };
}

/** Asks for a copy of the person's data. Needs a sign-in from the last few minutes. */
export async function requestDataExportAction(): Promise<RequestDataExportResult> {
  return requestDataExport(deps());
}

/** Deletes the person's ready copy before it expires. */
export async function deleteDataExportCopyAction(
  exportId: string,
): Promise<DeleteDataExportResult> {
  return deleteDataExportCopy(deps(), exportId);
}
