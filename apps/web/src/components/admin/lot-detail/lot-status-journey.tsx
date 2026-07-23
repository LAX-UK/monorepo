import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

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

function stepTone(active: boolean, done: boolean): "info" | "success" | "neutral" {
  if (active) return "info";
  if (done) return "success";
  return "neutral";
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
  const lastWhen = formatAdminTableDateTime(snapshot.lastEventAt, "timestamp");

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
        <span className="font-label text-[10px] uppercase tracking-wide text-secondary">
          Current status
        </span>
        <AdminStatusBadge domain="lot" status={snapshot.currentStatus} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <DotStatusPill
              label={step.label}
              tone={stepTone(step.active, step.done)}
              className={cn(!step.done && !step.active && "opacity-70")}
            />
            {index < steps.length - 1 ? (
              <span className="text-on-surface-variant/40" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="font-body text-xs text-on-surface-variant">
        Last activity: {lastLabel} ·{" "}
        <time dateTime={lastWhen.iso ?? undefined} title={lastWhen.title}>
          {lastWhen.primary}
        </time>
      </p>
      {recent.length > 0 ? (
        <ul className="space-y-1 border-t border-border-hairline pt-2">
          {recent.map((ev, i) => {
            const when = formatAdminTableDateTime(ev.occurredAt, "timestamp");
            return (
              <li
                key={`${ev.eventType}-${ev.occurredAt}-${i}`}
                className="font-body text-xs text-on-surface-variant"
              >
                {domainEventLabel(ev.eventType)}
                {ev.saleTitle ? ` · ${ev.saleTitle}` : ""} ·{" "}
                <time dateTime={when.iso ?? undefined} title={when.title}>
                  {when.primary}
                </time>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
