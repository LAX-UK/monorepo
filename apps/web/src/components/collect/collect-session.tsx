"use client";

import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { COLLECT_COPY, collectBookingEmail } from "@/lib/collect/collect-copy";
import { COLLECT_FIELD_IDS, validateCollectForm } from "@/lib/collect/collect-form";
import { collectReducer, initialCollectState } from "@/lib/collect/collect-state";
import {
  bookCollectionAction,
  changeCollectionAction,
  refreshAvailabilityAction,
} from "@/lib/collect/collect.actions";
import { HideBottomTabBarWhileMounted } from "@/lib/shell/shell-chrome-context";
import { formatCollectionWhen } from "@auction/domain";
import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import { Button, ButtonLink, ErrorSummary, FieldError, Notice } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useRef, useState } from "react";
import { BookedResult } from "./booked-result";
import { CollectCollectorPanel } from "./collect-collector-panel";
import { CollectDayPicker } from "./collect-day-picker";
import { CollectLotsPanel } from "./collect-lots-panel";
import { CollectTimePicker } from "./collect-time-picker";

export type CollectSessionProps = {
  availability: CollectionAvailability;
  lotIds: readonly string[];
  /** The visit being moved, or `null` when booking a new one. */
  visit: CollectionVisitView | null;
  /** The signed-in person's name: who "Me" brings photo ID as. */
  myName: string;
  /** The organisation's name when acting for one. */
  organisation: string | null;
  /** Someone viewing the account (support): sees everything, changes nothing. */
  viewOnly: boolean;
  /** The server's clock as an ISO string, so server and client draw the same dates. */
  nowIso: string;
  contactEmail: string;
};

function newKey(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * The booking page's working part: lots, day, time, who collects and the one action. All the
 * choices live in one reducer; the server decides whether the time is still free, so a time taken
 * a moment ago keeps everything the person entered and asks for another time.
 */
export function CollectSession(props: CollectSessionProps) {
  const { availability, visit, viewOnly } = props;
  const router = useRouter();
  const now = useMemo(() => new Date(props.nowIso), [props.nowIso]);
  const [state, dispatch] = useReducer(
    collectReducer,
    { availability, lotIds: props.lotIds, visit, myName: props.myName },
    initialCollectState,
  );
  const [booked, setBooked] = useState<{ visit: CollectionVisitView; moved: boolean } | null>(null);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [timesFailed, setTimesFailed] = useState(false);
  const submitting = state.phase === "submitting";
  const refreshing = state.phase === "refreshing";

  const dayView = state.availability.days.find((d) => d.date === state.day) ?? null;
  const slotLabel = state.slotStart ? formatCollectionWhen(new Date(state.slotStart), now) : null;
  const email = collectBookingEmail(props.contactEmail, availability.bookingEmail);

  if (booked) {
    return (
      <BookedResult
        visit={booked.visit}
        moved={booked.moved}
        now={now}
        contactEmail={props.contactEmail}
        viewOnly={viewOnly}
      />
    );
  }

  if (!availability.onlineBookingEnabled) {
    return (
      <Notice
        tone="info"
        title={COLLECT_COPY.off.title}
        actions={
          <ButtonLink href={`mailto:${email}`} variant="secondary">
            {COLLECT_COPY.off.email}
          </ButtonLink>
        }
      >
        {COLLECT_COPY.off.body}
      </Notice>
    );
  }

  async function refresh() {
    dispatch({ type: "refresh" });
    setTimesFailed(false);
    const result = await refreshAvailabilityAction({
      lotIds: availability.lots.map((lot) => lot.lotId),
      bookingId: visit?.id ?? null,
    });
    if (result.ok) dispatch({ type: "refreshed", availability: result.value });
    else {
      setTimesFailed(true);
      dispatch({ type: "refreshed", availability: state.availability });
    }
  }

  async function submit() {
    const checked = validateCollectForm(state, props.myName);
    if (!checked.ok) {
      dispatch({ type: "invalid", errors: checked.errors });
      return;
    }
    const fingerprint = JSON.stringify(checked.body);
    if (keyRef.current?.fingerprint !== fingerprint)
      keyRef.current = { fingerprint, key: newKey() };
    dispatch({ type: "submit" });
    const result = visit
      ? await changeCollectionAction({
          bookingId: visit.id,
          version: visit.version,
          body: checked.body,
          takenAt: slotLabel,
        })
      : await bookCollectionAction({
          body: checked.body,
          idempotencyKey: keyRef.current.key,
          takenAt: slotLabel,
        });
    if (result.ok) {
      setBooked({ visit: result.value, moved: visit !== null });
      return;
    }
    dispatch({ type: "failed", failure: result.failure });
    if (result.failure.kind === "slot_taken" || result.failure.kind === "too_late") await refresh();
    if (result.failure.kind === "changed") router.refresh();
  }

  const blocked = viewOnly;
  const confirmLabel = visit
    ? submitting
      ? COLLECT_COPY.confirm.changing
      : COLLECT_COPY.confirm.change
    : submitting
      ? COLLECT_COPY.confirm.booking
      : COLLECT_COPY.confirm.book;
  const chosenLots = state.lotIds.length;
  const noTimes = state.availability.days.every((d) => d.state !== "open" || d.openSlots === 0);
  const lotsError = state.errors.find((e) => e.fieldId === COLLECT_FIELD_IDS.lots)?.message;
  const timeError = state.errors.find((e) => e.fieldId === COLLECT_FIELD_IDS.time)?.message;
  const failure = state.failure;

  const action = (
    <Button
      variant="primary"
      onClick={submit}
      loading={submitting}
      disabled={blocked}
      className="w-full"
    >
      {confirmLabel}
    </Button>
  );

  return (
    <>
      <HideBottomTabBarWhileMounted />
      <div className="flex flex-col gap-6 max-lg:pb-28">
        {props.organisation ? (
          <p className="text-lax-13 text-lax-muted">
            {COLLECT_COPY.organisation(props.organisation)}
          </p>
        ) : null}
        {viewOnly ? (
          <Notice tone="info" title={COLLECT_COPY.viewOnly.title}>
            {COLLECT_COPY.viewOnly.body}
          </Notice>
        ) : null}
        <ErrorSummary
          errors={state.errors}
          focusKey={state.attempts}
          title={COLLECT_COPY.errors.summary(state.errors.length)}
        />
        {failure && failure.kind !== "collector" ? (
          <Notice
            tone={failure.kind === "slot_taken" ? "warning" : "danger"}
            alert
            title={failure.kind === "slot_taken" ? failure.title : failure.message}
            actions={
              failure.kind === "off" ? (
                <ButtonLink href={`mailto:${failure.bookingEmail ?? email}`} variant="secondary">
                  {COLLECT_COPY.off.email}
                </ButtonLink>
              ) : undefined
            }
          >
            {failure.kind === "slot_taken" ? failure.message : null}
          </Notice>
        ) : null}
        {noTimes ? (
          <Notice
            tone="info"
            title={COLLECT_COPY.noTimes.title}
            actions={
              <ButtonLink href={`mailto:${email}`} variant="secondary">
                {COLLECT_COPY.off.email}
              </ButtonLink>
            }
          >
            {COLLECT_COPY.noTimes.body}
          </Notice>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <CollectLotsPanel
              lots={state.availability.lots}
              selected={state.lotIds}
              disabled={blocked}
              error={lotsError}
              onToggle={(lotId) => dispatch({ type: "toggle_lot", lotId })}
            />

            <WorkspacePanel title={COLLECT_COPY.panels.day}>
              <p className="mb-3 text-lax-13 text-lax-muted">{COLLECT_COPY.panels.dayHint}</p>
              <CollectDayPicker
                days={state.availability.days}
                value={state.day}
                onValueChange={(date) => dispatch({ type: "select_day", date })}
                now={now}
              />
            </WorkspacePanel>

            <WorkspacePanel title={COLLECT_COPY.panels.time}>
              <div id={COLLECT_FIELD_IDS.time} tabIndex={-1} className="outline-none">
                <CollectTimePicker
                  slots={dayView?.slots ?? []}
                  value={state.slotStart}
                  onValueChange={(start) => dispatch({ type: "select_slot", start })}
                  loading={refreshing}
                  failed={timesFailed}
                  onRetry={refresh}
                  hasDay={dayView !== null}
                  visitMinutes={availability.visitMinutes}
                />
                {timeError ? (
                  <div className="mt-3">
                    <FieldError>{timeError}</FieldError>
                  </div>
                ) : null}
              </div>
            </WorkspacePanel>

            <CollectCollectorPanel state={state} myName={props.myName} dispatch={dispatch} />
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <WorkspacePanel title={COLLECT_COPY.panels.summary}>
              <dl className="flex flex-col gap-3 text-lax-14">
                <div>
                  <dt className="text-lax-13 text-lax-muted">Where</dt>
                  <dd className="text-lax-fg">{COLLECT_COPY.where}</dd>
                </div>
                <div>
                  <dt className="text-lax-13 text-lax-muted">When</dt>
                  <dd className="text-lax-fg">{slotLabel ?? COLLECT_COPY.confirm.chooseTime}</dd>
                </div>
                <div>
                  <dt className="text-lax-13 text-lax-muted">Lots</dt>
                  <dd className="text-lax-fg">
                    {chosenLots === 0 ? COLLECT_COPY.confirm.chooseLot : `${chosenLots} to collect`}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-lax-13 text-lax-muted">{COLLECT_COPY.confirm.cutoff}</p>
              {visit ? (
                <p className="mt-1 text-lax-13 text-lax-muted">
                  {COLLECT_COPY.confirm.keepsCurrent}
                </p>
              ) : null}
              <div className="mt-5 max-lg:hidden">{action}</div>
            </WorkspacePanel>
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-lax-line bg-lax-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <p className="min-w-0 flex-1 text-lax-13 text-lax-muted">
          {slotLabel ?? COLLECT_COPY.confirm.chooseTime}
        </p>
        <div className="shrink-0">{action}</div>
      </div>
    </>
  );
}
