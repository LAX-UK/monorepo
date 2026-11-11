"use client";

import { type ActionState, isGathered } from "@/lib/admin/data-requests/data-request-actions";
import {
  CHANNEL_LABELS,
  PRODUCT_DETAILS,
  PRODUCT_LABELS,
  REASON_LABELS,
  deadlineProgress,
  formatBytes,
  formatDay,
  formatMoment,
  productsDoneText,
} from "@/lib/admin/data-requests/data-requests.vm";
import {
  type DataRequestProduct,
  type DataRequestRecord,
  calendarDaysBetween,
} from "@auction/identity-contracts/data-requests";
import {
  KeyValueList,
  ProgressBar,
  Section,
  StaffButton,
  TextArea,
  UnsavedChangesDialog,
  cn,
  formatStaffNumber,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Check, Eye, Pencil, RotateCcw, Undo2 } from "@auction/staff-ui/icons";
import { useState } from "react";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import type { WriteFailure, WriteResult } from "./use-data-request-writes";

type StepState = DataRequestRecord["steps"][number]["state"];

const STEP_ICON: Record<StepState, { className: string; label: string }> = {
  done: { className: "bg-staff-success-bg text-staff-success-fg", label: "Done" },
  collecting: { className: "bg-staff-info-bg text-staff-info-fg", label: "Collecting" },
  retrying: { className: "bg-staff-warning-bg text-staff-warning-fg", label: "Retrying" },
  waiting: { className: "border border-staff-control-border text-staff-subtle", label: "Waiting" },
};

function StepMark({ state }: { state: StepState }) {
  const spec = STEP_ICON[state];
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        spec.className,
      )}
    >
      {state === "done" ? <Check aria-hidden className="size-3.5" /> : null}
      {state === "retrying" ? <RotateCcw aria-hidden className="size-3.5" /> : null}
      <span className="sr-only">{spec.label}</span>
    </span>
  );
}

function stepDetail(step: DataRequestRecord["steps"][number], manual: boolean): string {
  const parts: string[] = [];
  if (manual) {
    parts.push(
      step.gatheredAt
        ? `Gathered${step.gatheredBy ? ` by ${step.gatheredBy}` : ""}`
        : "Not gathered yet",
    );
  } else if (step.state === "retrying") parts.push("Retrying");
  else if (step.state === "waiting") parts.push("Waiting");
  else if (step.state === "collecting") parts.push("Collecting");
  if (step.records !== null && step.state === "done") {
    parts.push(`${formatStaffNumber(step.records)} records`);
  }
  parts.push(PRODUCT_DETAILS[step.product].company);
  return parts.join(" · ");
}

/**
 * One row per product in scope. A download shows what the worker has done; a manual request
 * shows who gathered each part, and offers Mark gathered (undoable for 10 seconds) and Unmark.
 */
export function ProductsSection({
  record,
  gather,
  busyProduct,
  onGather,
}: {
  record: DataRequestRecord;
  /** What a person may do with each product; absent for a download. */
  gather: ((product: DataRequestProduct) => ActionState) | null;
  busyProduct: DataRequestProduct | null;
  onGather: (product: DataRequestProduct, done: boolean) => void;
}) {
  const manual = record.request.kind === "manual";
  return (
    <Section
      id="products"
      title={manual ? "Products to gather" : "Products"}
      action={
        <span className="text-staff-sm text-staff-muted tabular-nums">
          {productsDoneText(record.request)} done
        </span>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-staff-line-subtle">
        {record.steps.map((step) => {
          const state = gather?.(step.product) ?? { kind: "hidden" as const };
          const done = isGathered(record, step.product);
          return (
            <li key={step.product} className="flex items-center gap-3 px-4 py-3">
              <StepMark state={step.state} />
              <span className="flex min-w-0 flex-1 flex-col text-staff-sm">
                <span className="font-medium text-staff-fg">
                  {PRODUCT_DETAILS[step.product].name}
                </span>
                <span className="text-staff-muted">{stepDetail(step, manual)}</span>
              </span>
              {step.gatheredAt ? (
                <span className="hidden text-staff-xs text-staff-muted tabular-nums sm:inline">
                  {formatMoment(step.gatheredAt)}
                </span>
              ) : null}
              {state.kind === "hidden" ? null : done ? (
                <StaffButton
                  size="sm"
                  variant="ghost"
                  icon={<Undo2 aria-hidden />}
                  loading={busyProduct === step.product}
                  onClick={() => onGather(step.product, false)}
                >
                  Unmark
                </StaffButton>
              ) : (
                <StaffButton
                  size="sm"
                  variant="secondary"
                  icon={<Check aria-hidden />}
                  loading={busyProduct === step.product}
                  {...(state.kind === "disabled" ? { disabledReason: state.reason } : {})}
                  onClick={() => onGather(step.product, true)}
                >
                  Mark gathered
                </StaffButton>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * The request's internal notes, edited in place. Leaving with unsaved text asks first. A save
 * that finds the request changed keeps the text in the box and offers a reload.
 */
export function NotesSection({
  notes,
  editable,
  save,
  onReload,
}: {
  notes: string | null;
  editable: boolean;
  save: (text: string) => Promise<WriteResult>;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const dirty = editing && draft.trim() !== (notes ?? "").trim();
  const guard = useUnsavedChanges(dirty, { label: "the notes", interceptBack: false });

  async function submit() {
    setBusy(true);
    setFailure(null);
    const result = await save(draft.trim());
    setBusy(false);
    if (result.ok) setEditing(false);
    else setFailure({ message: result.error, stale: result.errorCode === "stale_version" });
  }

  return (
    <Section
      id="notes"
      title="Notes"
      description="Internal. Don't paste the person's data here."
      action={
        editable && !editing ? (
          <StaffButton
            size="sm"
            variant="ghost"
            icon={<Pencil aria-hidden />}
            onClick={() => {
              setDraft(notes ?? "");
              setEditing(true);
            }}
          >
            Edit
          </StaffButton>
        ) : null
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          {failure ? (
            <DataRequestWriteFailure
              failure={failure}
              title="The note wasn't saved"
              onReload={onReload}
            />
          ) : null}
          <TextArea
            aria-label="Notes"
            rows={5}
            value={draft}
            maxLength={2000}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex gap-2">
            <StaffButton variant="primary" size="sm" loading={busy} onClick={() => void submit()}>
              Save notes
            </StaffButton>
            <StaffButton
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setFailure(null);
              }}
            >
              Cancel
            </StaffButton>
          </div>
        </div>
      ) : notes ? (
        <p className="whitespace-pre-wrap text-staff-sm leading-5 text-staff-fg">{notes}</p>
      ) : (
        <p className="text-staff-sm text-staff-muted">No notes have been added.</p>
      )}
      <UnsavedChangesDialog guard={guard} />
    </Section>
  );
}

/** The person's full details, on this page only. Opening the record is logged. */
export function PersonSection({ person }: { person: DataRequestRecord["person"] }) {
  return (
    <Section id="person" title="Person">
      <KeyValueList
        items={[
          { label: "Name", value: person.name ?? "Not recorded" },
          ...(person.email
            ? [{ label: "Email", value: person.email, copyValue: person.email }]
            : []),
          ...(person.contact
            ? [{ label: "Contact", value: person.contact, copyValue: person.contact }]
            : []),
          {
            label: "Account",
            value: person.hasAccount
              ? [
                  person.accountStatus,
                  person.joinedOn ? `joined ${formatDay(person.joinedOn)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Active"
              : "No account",
          },
        ]}
      />
      <p className="mt-3 flex items-start gap-2 text-staff-xs text-staff-muted">
        <Eye aria-hidden className="mt-px size-3.5 shrink-0" />
        Opening this record is logged in the audit log.
      </p>
    </Section>
  );
}

/** The legal date, how much of the time has gone, an extension if there is one. */
export function DeadlineSection({
  record,
  today,
  dueText,
  overdue,
  extend,
}: {
  record: DataRequestRecord;
  today: string;
  /** "27 days left", "1 day overdue". */
  dueText: string | null;
  overdue: boolean;
  /** Whether an extension is still possible: shown for a request that can be extended at all. */
  extend: ActionState;
}) {
  const { request, extension } = record;
  const progress = deadlineProgress(request, today, calendarDaysBetween);
  return (
    <Section id="deadline" title="Deadline">
      {request.dueOn ? (
        <div className="flex flex-col gap-2">
          <span
            className={cn(
              "text-staff-xl font-semibold tabular-nums",
              overdue ? "text-staff-danger-fg" : "text-staff-fg",
            )}
          >
            {formatDay(request.dueOn)}
          </span>
          <span className="text-staff-sm text-staff-muted">
            {[dueText, `one calendar month from ${formatDay(request.requestedOn)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {progress ? (
            <ProgressBar
              value={progress.used}
              max={progress.total}
              label="Time allowed used"
              tone={overdue ? "danger" : "neutral"}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-staff-sm text-staff-muted">
          There is no due date until proof of identity arrives.
        </p>
      )}
      {!extension && extend.kind !== "hidden" ? (
        <KeyValueList
          className="mt-3"
          items={[
            {
              label: "Extension",
              value:
                extend.kind === "disabled" ? (
                  <span className="flex flex-col">
                    <span>Not available</span>
                    <span className="text-staff-xs text-staff-muted">{extend.reason}</span>
                  </span>
                ) : (
                  "Available once, before the due date"
                ),
            },
          ]}
        />
      ) : null}
      {extension ? (
        <KeyValueList
          className="mt-3"
          items={[
            {
              label: "Extended",
              value: `${formatDay(extension.originalDueOn)} to ${formatDay(extension.extendedDueOn)}`,
            },
            {
              label: "Person told",
              value: `${formatDay(extension.personToldOn)} by ${extension.personToldVia.replace("_", " ")}`,
            },
          ]}
        />
      ) : null}
    </Section>
  );
}

/** Reason, channel and scope of a request staff logged. */
export function RequestSection({ record }: { record: DataRequestRecord }) {
  const { request } = record;
  if (request.kind !== "manual") return null;
  return (
    <Section id="request" title="Request">
      <KeyValueList
        items={[
          { label: "Reason", value: REASON_LABELS[request.reason] },
          { label: "Channel", value: CHANNEL_LABELS[request.channel] },
          {
            label: "Products",
            value: request.products.map((product) => PRODUCT_LABELS[product]).join(", "),
          },
          ...(record.continuedFrom
            ? [{ label: "Continued from", value: record.continuedFrom }]
            : []),
        ]}
      />
    </Section>
  );
}

/** What was built for the person. Never a link: staff don't download a person's copy. */
export function FileSection({ file }: { file: NonNullable<DataRequestRecord["file"]> | null }) {
  return (
    <Section id="file" title="The file">
      {file ? (
        <KeyValueList
          items={[
            ...(file.sizeBytes !== null
              ? [{ label: "Size", value: formatBytes(file.sizeBytes) }]
              : []),
            ...(file.expiresAt
              ? [{ label: "Available until", value: formatMoment(file.expiresAt) }]
              : []),
            { label: "Downloads", value: String(file.downloadCount), numeric: true },
            ...(file.sha256
              ? [{ label: "SHA-256", value: file.sha256, copyValue: file.sha256 }]
              : []),
          ]}
        />
      ) : (
        <KeyValueList
          items={[
            { label: "Status", value: "Not built yet" },
            { label: "Built", value: "When every product has answered. Never a partial copy." },
          ]}
        />
      )}
    </Section>
  );
}
