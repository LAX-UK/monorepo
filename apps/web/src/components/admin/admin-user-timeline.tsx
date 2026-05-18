"use client";

import {
  isAdminAuditEventType,
  presentAdminUserDomainEvent,
  presentAdminUserSession,
} from "@/lib/admin/admin-user-event-presenter";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminDomainEventRow, AdminUserActivityEntry } from "@/lib/data/http/admin.server";
import type {
  ActivityItem,
  ActivityKind,
  ActivityTone,
} from "@/lib/data/view-models/dashboard-activity.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Bell, Mail, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

const KIND_ICON: Partial<Record<ActivityKind, typeof Bell>> = {
  system: Mail,
  kyc: ShieldCheck,
  info: Bell,
};

const TONE_RING: Record<ActivityTone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  positive: "bg-lot-orange/15 text-lot-orange",
  negative: "bg-live-red/15 text-live-red",
  warning: "bg-lot-orange/15 text-lot-orange",
  info: "bg-primary/15 text-primary",
};

function buildTimelineItems(
  sessions: AdminUserActivityEntry[],
  domainEvents: AdminDomainEventRow[],
  auditOnly: boolean,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const s of sessions) {
    const p = presentAdminUserSession();
    items.push({
      id: `session-${s.id}`,
      kind: p.kind,
      tone: p.tone,
      title: p.title,
      ...(s.ipAddress ? { description: `IP ${s.ipAddress}` } : {}),
      at: s.createdAt,
    });
  }

  for (const e of domainEvents) {
    if (auditOnly && !isAdminAuditEventType(e.eventType)) continue;
    const p = presentAdminUserDomainEvent(e.eventType);
    items.push({
      id: `event-${e.id}`,
      kind: p.kind,
      tone: p.tone,
      title: p.title,
      ...(p.description ? { description: p.description } : {}),
      at: e.occurredAt.toISOString(),
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}

type Props = {
  sessions: AdminUserActivityEntry[];
  domainEvents: AdminDomainEventRow[];
  auditOnly?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function AdminUserTimeline({
  sessions,
  domainEvents,
  auditOnly = false,
  emptyTitle = "No activity",
  emptyDescription = "No sessions or account events recorded yet.",
}: Props) {
  const items = useMemo(
    () => buildTimelineItems(sessions, domainEvents, auditOnly),
    [sessions, domainEvents, auditOnly],
  );

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const now = new Date();

  return (
    <ul className="divide-y divide-outline-variant/10 rounded-lg border border-border-hairline bg-surface-container-lowest">
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind] ?? Bell;
        const ring = TONE_RING[item.tone] ?? TONE_RING.neutral;
        return (
          <li key={item.id}>
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${ring}`}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-headline text-sm font-semibold text-on-surface">
                  {item.title}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-on-surface-variant">
                    {item.description}
                  </span>
                ) : null}
              </span>
              <time
                dateTime={item.at}
                className="shrink-0 font-label text-[10px] uppercase tracking-wider text-on-surface-variant"
              >
                {relativeFromIso(item.at, now)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
