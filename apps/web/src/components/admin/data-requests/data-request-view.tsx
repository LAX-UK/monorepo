"use client";

import { recordActions } from "@/lib/admin/data-requests/data-request-actions";
import { dataRequestTimeline } from "@/lib/admin/data-requests/data-request-timeline";
import { dataRequestHref } from "@/lib/admin/data-requests/data-requests-search";
import {
  CHANNEL_LABELS,
  DUE_TONE,
  OUTCOME_LABELS,
  PRODUCT_DETAILS,
  PRODUCT_LABELS,
  daysLeftText,
  formatDay,
  isAnswered,
  kindParts,
  requestStatus,
} from "@/lib/admin/data-requests/data-requests.vm";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { notify } from "@/lib/ui/notify";
import type {
  DataRequestProduct,
  DataRequestRecord,
} from "@auction/identity-contracts/data-requests";
import {
  DetailPage,
  MetaItem,
  Notice,
  OverflowMenu,
  RecordPager,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  Timeline,
  toastUndo,
} from "@auction/staff-ui";
import { ArrowRight, CalendarPlus, Check, Copy } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseDataRequestDialog } from "./close-data-request-dialog";
import { ContinueDataRequestDialog } from "./continue-data-request-dialog";
import {
  DeadlineSection,
  FileSection,
  NotesSection,
  PersonSection,
  ProductsSection,
  RequestSection,
} from "./data-request-sections";
import { ExtendDataRequestDialog } from "./extend-data-request-dialog";
import { IdReceivedDialog } from "./id-received-dialog";
import { useDataRequestWrites } from "./use-data-request-writes";

const NextLink: StaffLinkComponent = Link;

type Dialog = "extend" | "close" | "continue" | "id-received" | null;

export type DataRequestViewProps = {
  record: DataRequestRecord;
  today: string;
  listHref: string;
  pager: {
    position: number;
    total: number;
    previousHref: string | null;
    nextHref: string | null;
  } | null;
  /** A dialog the list's row menu asked for. */
  initialAction: "extend" | "close" | "continue" | null;
};

function noticeFor(record: DataRequestRecord) {
  const { request } = record;
  const answered = isAnswered(request);
  if (record.ownRequest) {
    return (
      <Notice tone="info" title="This request is about you">
        Another person must handle a request about you. You can see it, but not act on it.
      </Notice>
    );
  }
  if (request.kind === "manual" && request.status === "closed") {
    const late = request.daysLate;
    return (
      <Notice
        tone={late ? "warning" : "success"}
        title={`Closed: ${request.outcome ? OUTCOME_LABELS[request.outcome] : "no outcome recorded"}`}
      >
        {[
          late === null
            ? null
            : late === 0
              ? "Answered on time."
              : `Answered ${late} ${late === 1 ? "day" : "days"} late.`,
          record.closedOn ? `Closed on ${formatDay(record.closedOn)}.` : null,
          record.outcomeNote,
        ]
          .filter(Boolean)
          .join(" ")}
      </Notice>
    );
  }
  if (request.kind === "download" && request.continuedAs) {
    return (
      <Notice
        tone="info"
        title={`Continued as ${request.continuedAs}`}
        actions={
          <StaffButton size="sm" variant="secondary" asChild>
            <Link href={dataRequestHref(request.continuedAs, null)}>
              Open {request.continuedAs}
            </Link>
          </StaffButton>
        }
      >
        Staff took this download over. The clock and the due date carry on from the original
        request.
      </Notice>
    );
  }
  if (answered) return null;
  if (request.due.state === "overdue" && request.dueOn) {
    return (
      <Notice
        tone="danger"
        title={`This request is ${Math.abs(request.due.daysLeft ?? 0)} ${Math.abs(request.due.daysLeft ?? 0) === 1 ? "day" : "days"} past its legal due date`}
      >
        Send what you have gathered and close it with an outcome. The record will show it was
        answered late.
        {request.kind === "manual" && !request.extended
          ? ` It can no longer be extended, because extensions must be recorded before ${formatDay(request.dueOn)}.`
          : ""}
      </Notice>
    );
  }
  if (
    request.kind === "download" &&
    (request.status === "delayed" || request.status === "failed")
  ) {
    const stuck = record.steps
      .filter((step) => step.state === "retrying")
      .map((step) => PRODUCT_LABELS[step.product]);
    const names = stuck.length > 0 ? stuck.join(" and ") : "A product";
    return request.status === "failed" ? (
      <Notice tone="danger" title="The download failed">
        The person has not received their copy. Continue manually so they still get it by{" "}
        {request.dueOn ? formatDay(request.dueOn) : "the due date"}.
      </Notice>
    ) : (
      <Notice tone="warning" title={`${names} hasn't answered`}>
        The worker keeps retrying on its own. If it can't answer in time, continue manually so the
        person still gets their copy by {request.dueOn ? formatDay(request.dueOn) : "the due date"}.
      </Notice>
    );
  }
  if (request.kind === "manual" && request.status === "waiting_for_id") {
    return (
      <Notice tone="info" title="Waiting for proof of identity">
        There is no due date yet. When the proof arrives, record the day and the clock starts.
      </Notice>
    );
  }
  return null;
}

/**
 * One request on the staff record page: what it is, where it stands against its legal due date,
 * what is left to do and what has happened. Each action opens a dialog that states its effect;
 * the button is the confirmation. A request about the signed-in person is view only. J and K
 * move through the list it was opened from.
 */
export function DataRequestView({
  record,
  today,
  listHref,
  pager,
  initialAction,
}: DataRequestViewProps) {
  const router = useRouter();
  const { request } = record;
  const actions = recordActions(record);
  const writes = useDataRequestWrites(request.reference, record.version);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyProduct, setBusyProduct] = useState<DataRequestProduct | null>(null);

  // A row menu can ask for a dialog; open it once if it is allowed, then tidy the address.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opens once, on arrival
  useEffect(() => {
    if (!initialAction) return;
    const allowed =
      (initialAction === "extend" && actions.extend.kind === "enabled") ||
      (initialAction === "close" && actions.close.kind === "enabled") ||
      (initialAction === "continue" && actions.continueManually.kind === "enabled");
    if (allowed) setDialog(initialAction);
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const status = requestStatus(request);
  const answered = isAnswered(request);
  const dueText = daysLeftText(request.due);
  const overdue = !answered && request.due.state === "overdue";
  const kind = kindParts(request);

  const gather = async (product: DataRequestProduct, done: boolean) => {
    setBusyProduct(product);
    const result = await writes.patch({ gathered: { product, done } });
    setBusyProduct(null);
    const name = PRODUCT_DETAILS[product].name;
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    if (done) {
      toastUndo({
        title: `${name} marked gathered`,
        description: request.reference,
        onUndo: () => void gather(product, false),
      });
    } else {
      notify.success(`${name} unmarked`);
    }
  };

  const primary =
    actions.primary === "close" ? (
      <StaffButton
        variant="primary"
        icon={<Check aria-hidden />}
        onClick={() => setDialog("close")}
      >
        Close with outcome…
      </StaffButton>
    ) : actions.primary === "id-received" ? (
      <StaffButton variant="primary" onClick={() => setDialog("id-received")}>
        ID received on…
      </StaffButton>
    ) : undefined;

  const secondary = (
    <>
      {actions.extend.kind === "hidden" ? null : (
        <StaffButton
          variant="secondary"
          icon={<CalendarPlus aria-hidden />}
          onClick={() => setDialog("extend")}
          {...(actions.extend.kind === "disabled" ? { disabledReason: actions.extend.reason } : {})}
        >
          Extend…
        </StaffButton>
      )}
      {actions.primary === "id-received" && actions.close.kind === "enabled" ? (
        <StaffButton variant="secondary" onClick={() => setDialog("close")}>
          Close with outcome…
        </StaffButton>
      ) : null}
      {actions.continueManually.kind === "enabled" ? (
        <StaffButton
          variant="secondary"
          icon={<ArrowRight aria-hidden />}
          onClick={() => setDialog("continue")}
        >
          Continue manually…
        </StaffButton>
      ) : null}
    </>
  );

  const collected = record.steps
    .filter((step) => step.state === "done")
    .map((step) => step.product);
  const notice = noticeFor(record);

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Compliance" },
              { label: "Data requests", href: listHref },
              { label: request.reference },
            ]}
          />
        }
        {...(pager
          ? {
              pager: (
                <RecordPager
                  position={pager.position}
                  total={pager.total}
                  previousHref={pager.previousHref}
                  nextHref={pager.nextHref}
                  noun="request"
                  Link={NextLink}
                  navigate={(href) => router.push(href)}
                />
              ),
            }
          : {})}
        title={<span className="tabular-nums">{request.reference}</span>}
        status={
          <>
            <StatusBadge tone={status.tone} {...(status.shape ? { shape: status.shape } : {})}>
              {status.label}
            </StatusBadge>
            {overdue && dueText ? (
              <StatusBadge tone={DUE_TONE[request.due.state] === "danger" ? "danger" : "warning"}>
                {dueText}
              </StatusBadge>
            ) : null}
          </>
        }
        meta={
          <>
            <MetaItem label="Kind">{kind.primary}</MetaItem>
            <MetaItem label={request.kind === "manual" ? "Received" : "Requested"}>
              {formatDay(request.requestedOn)}
              {request.kind === "manual" ? ` · ${CHANNEL_LABELS[request.channel]}` : ""}
            </MetaItem>
            <MetaItem label="Due">
              {request.dueOn
                ? `${formatDay(request.dueOn)}${!answered && dueText ? ` · ${dueText}` : ""}`
                : "Starts when ID arrives"}
            </MetaItem>
            <MetaItem label="Products">
              {request.products.map((product) => PRODUCT_LABELS[product]).join(", ")}
            </MetaItem>
          </>
        }
        access={actions.viewOnlyReason ? "read-only" : "full"}
        resource="Data requests"
        {...(primary ? { primaryAction: primary } : {})}
        secondaryActions={secondary}
        overflow={
          <OverflowMenu
            label="More request actions"
            Link={NextLink}
            actions={[
              {
                id: "copy-reference",
                label: "Copy reference",
                icon: Copy,
                onSelect: () => copyToClipboard(request.reference, "Reference"),
              },
              {
                id: "back",
                label: "Back to the list",
                href: listHref,
              },
            ]}
          />
        }
        notice={notice ?? undefined}
        rail={
          <>
            <PersonSection person={record.person} />
            <DeadlineSection
              record={record}
              today={today}
              dueText={answered ? null : dueText}
              overdue={overdue}
              extend={actions.extend}
            />
            <RequestSection record={record} />
            {request.kind === "download" ? <FileSection file={record.file} /> : null}
          </>
        }
        railLabel="Request details"
        railPlacement="before"
      >
        <ProductsSection
          record={record}
          gather={request.kind === "manual" && request.status !== "closed" ? actions.gather : null}
          busyProduct={busyProduct}
          onGather={(product, done) => void gather(product, done)}
        />
        {request.kind === "manual" ? (
          <NotesSection
            notes={record.notes}
            editable={actions.editNotes.kind === "enabled"}
            save={(text) => writes.patch({ notes: text })}
            onReload={writes.reload}
          />
        ) : null}
        <Section id="history" title="History" description="From the request's audit">
          <Timeline label="Request history" events={dataRequestTimeline(record.timeline)} />
        </Section>
      </DetailPage>

      {request.kind === "manual" ? (
        <>
          <ExtendDataRequestDialog
            key={`extend-${record.version}`}
            open={dialog === "extend"}
            onOpenChange={(open) => setDialog(open ? "extend" : null)}
            reference={request.reference}
            originalDueOn={request.dueOn ?? today}
            today={today}
            submit={writes.extend}
            onReload={writes.reload}
            onDone={(due) =>
              notify.success(`${request.reference} extended · due ${formatDay(due)}`)
            }
          />
          <CloseDataRequestDialog
            key={`close-${record.version}`}
            open={dialog === "close"}
            onOpenChange={(open) => setDialog(open ? "close" : null)}
            request={request}
            submit={writes.close}
            onReload={writes.reload}
            onDone={(outcome) =>
              notify.success(`${request.reference} closed · ${OUTCOME_LABELS[outcome]}`)
            }
          />
          <IdReceivedDialog
            open={dialog === "id-received"}
            onOpenChange={(open) => setDialog(open ? "id-received" : null)}
            reference={request.reference}
            requestReceivedOn={request.requestedOn}
            today={today}
            submit={(day) => writes.patch({ idReceivedOn: day })}
            onReload={writes.reload}
            onDone={(due) =>
              notify.success(`Clock started · ${request.reference} due ${formatDay(due)}`)
            }
          />
        </>
      ) : (
        <ContinueDataRequestDialog
          open={dialog === "continue"}
          onOpenChange={(open) => setDialog(open ? "continue" : null)}
          request={request}
          collected={collected}
          submit={writes.continueManually}
          onReload={writes.reload}
          onDone={(reference) => {
            notify.success(`${reference} created · ${request.reference} continued manually`);
            router.push(dataRequestHref(reference, null));
          }}
        />
      )}
    </>
  );
}
