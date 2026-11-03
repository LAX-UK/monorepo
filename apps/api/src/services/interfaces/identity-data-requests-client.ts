import type {
  CloseDataRequestInput,
  CreateDataRequestInput,
  DataRequestList,
  DataRequestListQuery,
  DataRequestRecord,
  DataRequestSummary,
  ExtendDataRequestInput,
  PatchDataRequestInput,
} from "@auction/identity-contracts";

/** A business refusal from Identity: its code and the HTTP status it came with (403, 404, 409 or 422). */
export type DataRequestRefusal = { ok: false; status: number; error: string };

export type DataRequestOutcome<T> = { ok: true; value: T } | DataRequestRefusal;

/** Thrown when Identity cannot be reached or answers something unusable; callers answer 503. */
export class DataRequestsUnavailableError extends Error {
  constructor(message = "Identity data requests are unavailable") {
    super(message);
    this.name = "DataRequestsUnavailableError";
  }
}

type WithoutActor<T> = Omit<T, "actorSubjectId">;

/**
 * Identity's data request routes as Bid admin uses them. The acting staff member is passed as
 * `actorSubjectId` on every call that acts or opens a record, so Identity can refuse a request
 * about that person. Emails come back masked in lists.
 */
export interface IIdentityDataRequestsClient {
  list(query: DataRequestListQuery): Promise<DataRequestList>;
  summary(): Promise<DataRequestSummary>;
  record(reference: string, actorSubjectId: string): Promise<DataRequestOutcome<DataRequestRecord>>;
  create(input: CreateDataRequestInput): Promise<DataRequestOutcome<DataRequestRecord>>;
  patch(
    reference: string,
    input: PatchDataRequestInput,
  ): Promise<DataRequestOutcome<DataRequestRecord>>;
  extend(
    reference: string,
    input: ExtendDataRequestInput,
  ): Promise<DataRequestOutcome<DataRequestRecord>>;
  close(
    reference: string,
    input: CloseDataRequestInput,
  ): Promise<DataRequestOutcome<DataRequestRecord>>;
  continueDownload(
    reference: string,
    actorSubjectId: string,
  ): Promise<DataRequestOutcome<DataRequestRecord>>;
}

export type { WithoutActor };
