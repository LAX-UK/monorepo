import {
  type CloseDataRequestInput,
  type CreateDataRequestInput,
  DATA_REQUESTS_PAGE_SIZE,
  type DataRequestError,
  type DataRequestList,
  type DataRequestListQuery,
  type DataRequestRecord,
  type DataRequestSummary,
  type ExtendDataRequestInput,
  type PatchDataRequestInput,
  isDownloadReference,
  isManualReference,
  londonCalendarDate,
} from "@auction/identity-contracts";
import { decodeCursor, encodeCursor } from "./data-request.cursor.js";
import type {
  DataRequestReader,
  DataRequestWriter,
  ManualDecision,
  ManualRequestRow,
} from "./data-request.ports.js";
import {
  planClose,
  planContinue,
  planCreate,
  planExtend,
  planPatch,
} from "./data-request.rules.js";
import { toRecord, toRequestView } from "./data-request.views.js";

export type DataRequestResult<T> = { ok: true; value: T } | { ok: false; error: DataRequestError };

const fail = (error: DataRequestError): { ok: false; error: DataRequestError } => ({
  ok: false,
  error,
});

export type DataRequestPorts = {
  reader: DataRequestReader;
  writer: DataRequestWriter;
};

/**
 * Staff's "Data requests", decided in one place. Reads merge the automatic downloads and the
 * manual requests on one clock; writes go through the rules in `data-request.rules` and are
 * applied, with their audit rows, under a row lock. The actor is never the subject of the request.
 */
export class DataRequestService {
  constructor(
    private readonly ports: DataRequestPorts,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private today(): string {
    return londonCalendarDate(this.now());
  }

  async list(query: DataRequestListQuery): Promise<DataRequestList> {
    const today = this.today();
    const { cursor, ...filter } = query;
    const after = cursor ? decodeCursor(query.sort, cursor) : undefined;
    const rows = await this.ports.reader.list({
      ...filter,
      today,
      limit: DATA_REQUESTS_PAGE_SIZE + 1,
      ...(after ? { after } : {}),
    });
    const page = rows.slice(0, DATA_REQUESTS_PAGE_SIZE);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => toRequestView(row, today)),
      nextCursor:
        rows.length > DATA_REQUESTS_PAGE_SIZE && last ? encodeCursor(query.sort, last) : null,
    };
  }

  summary(): Promise<DataRequestSummary> {
    return this.ports.reader.summary(this.today());
  }

  async record(
    reference: string,
    actorSubjectId: string,
  ): Promise<DataRequestResult<DataRequestRecord>> {
    const source = await this.ports.reader.findRecord(reference);
    if (source === null) return fail("not_found");
    if (source === "ambiguous_reference") return fail("ambiguous_reference");
    return { ok: true, value: toRecord(source, actorSubjectId, this.today()) };
  }

  async create(input: CreateDataRequestInput): Promise<DataRequestResult<DataRequestRecord>> {
    const accountExists =
      input.person.kind === "account"
        ? await this.ports.reader.accountExists(input.person.subjectId)
        : true;
    const plan = planCreate(input, { today: this.today(), now: this.now(), accountExists });
    if (!plan.ok) return plan;
    const row = await this.ports.writer.create(plan.request, plan.audit);
    return this.record(row.reference, input.actorSubjectId);
  }

  patch(reference: string, input: PatchDataRequestInput) {
    return this.mutate(reference, input.actorSubjectId, (row) =>
      planPatch(row, input, this.context()),
    );
  }

  extend(reference: string, input: ExtendDataRequestInput) {
    return this.mutate(reference, input.actorSubjectId, (row) =>
      planExtend(row, input, this.context()),
    );
  }

  close(reference: string, input: CloseDataRequestInput) {
    return this.mutate(reference, input.actorSubjectId, (row) =>
      planClose(row, input, this.context()),
    );
  }

  /** Continues a delayed or failed download as a manual request that keeps its dates. */
  async continueDownload(
    reference: string,
    actorSubjectId: string,
  ): Promise<DataRequestResult<DataRequestRecord>> {
    if (!isDownloadReference(reference)) return fail("continue_not_allowed");
    const context = this.context();
    const outcome = await this.ports.writer.continueDownload(
      reference,
      actorSubjectId,
      (download, continued) => planContinue(download, continued, actorSubjectId, context),
    );
    if (outcome === null) return fail("not_found");
    if (!outcome.ok) return outcome;
    return this.record(outcome.row.reference, actorSubjectId);
  }

  private context() {
    return { today: this.today(), now: this.now() };
  }

  /** Applies one rule to a manual request, then answers with the record as it now stands. */
  private async mutate(
    reference: string,
    actorSubjectId: string,
    decide: (row: ManualRequestRow) => ManualDecision,
  ): Promise<DataRequestResult<DataRequestRecord>> {
    if (!isManualReference(reference)) {
      return fail(isDownloadReference(reference) ? "not_manual" : "not_found");
    }
    const outcome = await this.ports.writer.mutate(reference, actorSubjectId, decide);
    if (outcome === null) return fail("not_found");
    if (!outcome.ok) return outcome;
    return this.record(outcome.row.reference, actorSubjectId);
  }
}
