import type { SubjectExportCreateOutcome, SubjectExportView } from "@auction/identity-contracts";
import type { IdentityActor } from "./account-identity-gateway";

/** The person's own browser and address, forwarded so Identity can record and report them. */
export type DataExportClient = { ip: string | null; userAgent: string | null };

/**
 * What Identity said to a data-download call:
 *  - `reauth_required`: the sign-in is too old for this, or has ended;
 *  - `gone`: the copy is not there to download (expired, deleted or unknown);
 *  - `unavailable`: Identity or the file store refused, failed or did not answer; nothing is
 *    known to have changed.
 */
export type DataExportCallResult<T> =
  | { status: "ok"; value: T }
  | { status: "reauth_required" }
  | { status: "gone" }
  | { status: "unavailable" };

/**
 * The latest request, and when a new copy can next be asked for. `retryAfter` is only the
 * rate-limit date: null means "not rate-limited", not "can ask now", because an open request also
 * stops a new one. The open request, if any, is `view`.
 */
export type DataExportCurrent = { view: SubjectExportView | null; retryAfter: string | null };

/** The person's data download as LAX Identity runs it. Account only asks and shows. */
export type DataExportGateway = {
  /** The latest request (null when there has never been one) and the rate-limit date, if any. */
  readCurrent(actor: IdentityActor): Promise<DataExportCallResult<DataExportCurrent>>;
  /** Needs a recent sign-in. "Already open" and "too many requests" are answers, not failures. */
  request(
    actor: IdentityActor,
    client: DataExportClient,
  ): Promise<DataExportCallResult<SubjectExportCreateOutcome>>;
  /** Needs a recent sign-in. Resolves to a link that works for a few minutes. */
  download(
    actor: IdentityActor,
    exportId: string,
    client: DataExportClient,
  ): Promise<DataExportCallResult<{ url: string }>>;
  /** Deletes the copy early. `not_found` means it was already gone. */
  deleteCopy(
    actor: IdentityActor,
    exportId: string,
  ): Promise<DataExportCallResult<"deleted" | "not_found">>;
};
