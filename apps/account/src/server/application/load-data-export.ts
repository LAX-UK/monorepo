import { getLaxAccountContainer } from "../container";
import type { DataExportRead } from "../domain/data-export.vm";
import { loadActor } from "./load-account-actor";

/** The person's latest data request. Any failure is `unavailable`: nothing is guessed. */
export async function loadDataExport(): Promise<DataExportRead> {
  const actor = await loadActor();
  if (typeof actor === "string") return { status: "unavailable" };
  const result = await getLaxAccountContainer().dataExports.readCurrent(actor);
  return result.status === "ok" ? { status: "ok", view: result.value } : { status: "unavailable" };
}
