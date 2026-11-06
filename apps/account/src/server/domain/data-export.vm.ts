import { formatDate, formatDateTime, formatTime, isSameLondonDay } from "@/lib/format-date";
import {
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportProduct,
  type SubjectExportView,
} from "@auction/identity-contracts";

export const DEFAULT_DATA_EXPORT_SUBTITLE = "A copy of the information LAX holds about you";

const LARGE_FILE_BYTES = 25_000_000;

export function formatDataExportSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

function downloadedLabel(count: number): string {
  if (count === 0) return "not downloaded yet";
  if (count === 1) return "downloaded once";
  return `downloaded ${count} times`;
}

/** A copy that is still marked ready but whose time is up is expired, whatever the worker has done. */
function effectiveStatus(view: SubjectExportView, now: Date): SubjectExportView["status"] {
  if (view.status === "ready" && view.expiresAt && new Date(view.expiresAt) <= now) {
    return "expired";
  }
  return view.status;
}

/** One line under the "Download your data" row on the Privacy page. */
export function buildDataExportRowSubtitle(view: SubjectExportView | null, now: Date): string {
  if (!view) return DEFAULT_DATA_EXPORT_SUBTITLE;
  const status = effectiveStatus(view, now);
  switch (status) {
    case "requested":
    case "collecting":
      return "Preparing, we'll email you";
    case "delayed":
    case "failed":
      return "Taking longer than usual";
    case "ready":
      return view.expiresAt
        ? `Ready until ${formatDate(view.expiresAt)}`
        : DEFAULT_DATA_EXPORT_SUBTITLE;
    case "expired":
    case "deleted": {
      const when = status === "deleted" ? view.deletedAt : view.expiresAt;
      if (!when) return DEFAULT_DATA_EXPORT_SUBTITLE;
      return `Last copy ${status === "deleted" ? "deleted" : "expired"} ${formatDate(when)}`;
    }
  }
}

export type DataExportProductVm = {
  product: SubjectExportProduct;
  name: string;
  state: "waiting" | "collecting" | "done" | "retrying";
  label: string;
};

const PROGRESS_LABEL: Record<DataExportProductVm["state"], string> = {
  waiting: "Waiting",
  collecting: "Collecting",
  done: "Done",
  retrying: "Trying again",
};

/** All three products, in a fixed order, whether or not Identity has reported on each yet. */
function productProgress(view: SubjectExportView): DataExportProductVm[] {
  return SUBJECT_EXPORT_PRODUCTS.map((product) => {
    const state = view.products.find((entry) => entry.product === product)?.state ?? "waiting";
    return {
      product,
      name: SUBJECT_EXPORT_PRODUCT_INFO[product].name,
      state,
      label: PROGRESS_LABEL[state],
    };
  });
}

/**
 * What the Download your data page shows. Each kind is a different panel (wireframes A to F):
 *  - `unavailable`: Identity could not be asked, so nothing is known and nothing is offered;
 *  - `ready_to_request` (A): nothing is open, so one primary action;
 *  - `preparing` (C): the request is recorded; no new request until it ends;
 *  - `ready` (D): the copy can be downloaded or deleted;
 *  - `delayed` (E): a product has not answered; `dueOn` is the legal due date;
 *  - `expired` (F): the last copy is gone and a new one can be asked for.
 */
export type DataExportPageVm =
  | { kind: "unavailable" }
  | { kind: "ready_to_request" }
  | {
      kind: "preparing";
      requestedAt: string;
      email: string | null;
      products: DataExportProductVm[];
      /** Every product has answered; the file is being put together, the last step before ready. */
      assembling: boolean;
    }
  | {
      kind: "ready";
      exportId: string;
      fileName: string;
      size: string;
      largeFile: boolean;
      preparedAt: string;
      availableUntil: string;
      downloads: string;
    }
  | { kind: "delayed"; dueOn: string; email: string | null; products: DataExportProductVm[] }
  | { kind: "expired"; message: string };

export type DataExportRead =
  | { status: "ok"; view: SubjectExportView | null }
  | { status: "unavailable" };

export function buildDataExportPageVm(
  read: DataExportRead,
  now: Date,
  email: string | null = null,
): DataExportPageVm {
  if (read.status === "unavailable") return { kind: "unavailable" };
  const view = read.view;
  if (!view) return { kind: "ready_to_request" };
  const status = effectiveStatus(view, now);
  switch (status) {
    case "requested":
    case "collecting": {
      const requested = new Date(view.requestedAt);
      const products = productProgress(view);
      return {
        kind: "preparing",
        requestedAt: isSameLondonDay(requested, now)
          ? `today at ${formatTime(requested)}`
          : formatDateTime(requested, now),
        email,
        products,
        assembling: products.every((entry) => entry.state === "done"),
      };
    }
    case "delayed":
    case "failed":
      return {
        kind: "delayed",
        dueOn: formatDate(view.dueAt),
        email,
        products: productProgress(view),
      };
    case "ready": {
      if (!view.fileName || view.sizeBytes === null || !view.readyAt || !view.expiresAt) {
        // A copy marked ready with no file to show is not something to offer for download.
        return { kind: "unavailable" };
      }
      const prepared = new Date(view.readyAt);
      return {
        kind: "ready",
        exportId: view.id,
        fileName: view.fileName,
        size: formatDataExportSize(view.sizeBytes),
        largeFile: view.sizeBytes >= LARGE_FILE_BYTES,
        preparedAt: formatDateTime(prepared, now),
        availableUntil: formatDate(view.expiresAt),
        downloads: downloadedLabel(view.downloadCount),
      };
    }
    case "expired":
    case "deleted": {
      const prepared = view.readyAt ? new Date(view.readyAt) : null;
      const preparedOn = prepared ? `, prepared on ${formatDate(prepared)},` : "";
      if (status === "deleted" && view.deletedAt) {
        return {
          kind: "expired",
          message: `You deleted your last copy on ${formatDate(view.deletedAt)}. It has been removed.`,
        };
      }
      return {
        kind: "expired",
        message: view.expiresAt
          ? `Your last copy${preparedOn} expired on ${formatDate(view.expiresAt)} and has been deleted.`
          : "Your last copy has expired and has been deleted.",
      };
    }
  }
}

/** What the page says after Identity answers that four copies were asked for in 30 days. */
export function buildRateLimitedMessage(retryAfter: string): string {
  return `You've asked for the most copies we can prepare in 30 days. You can ask again from ${formatDate(retryAfter)}.`;
}
