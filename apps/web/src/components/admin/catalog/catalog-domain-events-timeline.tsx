"use client";

import { ExportButton } from "@/components/exports/export-button";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

type Props = {
  events: readonly AdminDomainEventRow[];
  emptyMessage?: string;
  exportFilters?: { aggregateType: string; aggregateId: string };
  /** When false, hides raw event types and JSON payloads behind a disclosure. */
  showTechnicalDetails?: boolean;
};

export function CatalogDomainEventsTimeline({
  events,
  emptyMessage = "No activity recorded yet.",
  exportFilters,
  showTechnicalDetails = false,
}: Props) {
  if (events.length === 0) {
    return (
      <div className="space-y-3">
        {exportFilters ? (
          <div className="flex justify-end">
            <ExportButton entityType="domain-events" filters={exportFilters} />
          </div>
        ) : null}
        <p className="font-body text-sm text-on-surface-variant">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exportFilters ? (
        <div className="flex justify-end">
          <ExportButton entityType="domain-events" filters={exportFilters} />
        </div>
      ) : null}
      <ol className="relative space-y-0 border-l border-border-hairline pl-4">
        {events.map((event) => (
          <li key={event.id} className="relative pb-6 last:pb-0">
            <span
              className="absolute -left-[5px] top-1.5 size-2 rounded-full bg-primary ring-2 ring-surface"
              aria-hidden
            />
            <div className="rounded-lg border border-border-hairline/60 bg-surface-container-low/40 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-body text-sm font-medium text-on-surface">
                  {domainEventLabel(event.eventType)}
                </p>
                <time
                  dateTime={event.occurredAt.toISOString()}
                  className="font-body text-xs text-on-surface-variant"
                >
                  {relativeFromIso(event.occurredAt.toISOString())}
                </time>
              </div>
              {showTechnicalDetails ? (
                <>
                  <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                    {event.eventType}
                  </p>
                  {event.actorUserId ? (
                    <p className="mt-1 font-body text-xs text-on-surface-variant">
                      Actor: {event.actorUserId.slice(0, 8)}…
                    </p>
                  ) : null}
                  <EventPayload payload={event.payload} label="payload" />
                </>
              ) : (
                <EventTechnicalDetails
                  eventType={event.eventType}
                  actorUserId={event.actorUserId}
                  payload={event.payload}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EventTechnicalDetails({
  eventType,
  actorUserId,
  payload,
}: {
  eventType: string;
  actorUserId: string | null;
  payload: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const hasPayload = Object.keys(payload).length > 0;
  if (!hasPayload && !actorUserId) return null;

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="link"
        onClick={() => setOpen((v) => !v)}
        className="h-auto min-h-0 p-0 font-label text-[10px] uppercase tracking-wide shadow-none"
      >
        {open ? "Hide technical details" : "Technical details"}
      </Button>
      {open ? (
        <div className="mt-2 space-y-1">
          <p className="font-mono text-[10px] text-on-surface-variant">{eventType}</p>
          {actorUserId ? (
            <p className="font-body text-xs text-on-surface-variant">
              Actor: {actorUserId.slice(0, 8)}…
            </p>
          ) : null}
          {hasPayload ? <EventPayload payload={payload} label="payload" defaultOpen /> : null}
        </div>
      ) : null}
    </div>
  );
}

function EventPayload({
  payload,
  label = "payload",
  defaultOpen = false,
}: {
  payload: Record<string, unknown>;
  label?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const keys = Object.keys(payload);
  if (keys.length === 0) return null;

  return (
    <div className="mt-2">
      {!defaultOpen ? (
        <Button
          type="button"
          variant="link"
          onClick={() => setOpen((v) => !v)}
          className="h-auto min-h-0 p-0 font-label text-[10px] uppercase tracking-wide shadow-none"
        >
          {open ? `Hide ${label}` : `Show ${label}`}
        </Button>
      ) : null}
      {open ? (
        <pre
          className={cn(
            "mt-2 max-h-48 overflow-auto rounded-md bg-surface-container-low p-2",
            "font-mono text-[10px] text-on-surface-variant",
          )}
        >
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
