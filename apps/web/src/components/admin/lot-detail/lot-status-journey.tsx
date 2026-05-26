import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { formatDateTime } from "@/lib/ui/format";

export type LotStatusJourneySnapshot = {
  currentStatus: string;
  lastEventType: string;
  lastEventAt: string;
  lastSaleId: string | null;
  returnCount: number;
};

export type LotStatusJourneyEvent = {
  eventType: string;
  occurredAt: string;
  saleTitle?: string | null;
};

type Props = {
  snapshot: LotStatusJourneySnapshot | null;
  events: readonly LotStatusJourneyEvent[];
  saleName?: string | null;
};

function pill(active: boolean, done: boolean) {
  if (active) return "border-primary bg-primary/10 text-primary";
  if (done) return "border-outline-variant/40 bg-surface-container-low text-on-surface";
  return "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant";
}

export function LotStatusJourney({ snapshot, events, saleName }: Props) {
  if (!snapshot) return null;

  const returned = snapshot.returnCount > 0;
  const attached = Boolean(snapshot.lastSaleId || saleName);
  const listed = ["scheduled", "active", "ended", "cancelled", "voided"].includes(
    snapshot.currentStatus,
  );
  const terminal = ["ended", "cancelled", "voided", "draft"].includes(snapshot.currentStatus);
  const lastLabel = domainEventLabel(snapshot.lastEventType);

  const steps = [
    { key: "created", label: "Created", done: true, active: false },
    {
      key: "attached",
      label: attached ? `Attached${saleName ? ` (${saleName})` : ""}` : "Attached",
      done: attached,
      active: attached && !listed,
    },
    {
      key: "listed",
      label: "Listed",
      done: listed,
      active: listed && snapshot.currentStatus === "active",
    },
    {
      key: "outcome",
      label: returned
        ? "Returned"
        : snapshot.currentStatus === "ended"
          ? "Ended"
          : snapshot.currentStatus === "cancelled"
            ? "Cancelled"
            : snapshot.currentStatus === "voided"
              ? "Voided"
              : "Ended / Returned",
      done: terminal && snapshot.currentStatus !== "draft",
      active: returned || (terminal && snapshot.currentStatus !== "draft"),
    },
  ];

  const recent = events.slice(-3);

  return (
    <div className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-lowest/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 font-label text-[10px] uppercase tracking-wide ${pill(step.active, step.done)}`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="text-on-surface-variant/40" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="font-body text-xs text-on-surface-variant">
        Last activity: {lastLabel} · {formatDateTime(new Date(snapshot.lastEventAt))}
      </p>
      {recent.length > 0 ? (
        <ul className="space-y-1 border-t border-border-hairline pt-2">
          {recent.map((ev, i) => (
            <li
              key={`${ev.eventType}-${ev.occurredAt}-${i}`}
              className="font-body text-xs text-on-surface-variant"
            >
              {domainEventLabel(ev.eventType)}
              {ev.saleTitle ? ` · ${ev.saleTitle}` : ""} · {formatDateTime(new Date(ev.occurredAt))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
