"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { WorkInboxRowActions } from "@/components/admin/personal-dashboard/work-inbox/work-inbox-row-actions";
import {
  ownerLabel,
  severityAccentClass,
} from "@/components/admin/personal-dashboard/work-inbox/work-inbox-utils";
import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { Button } from "@auction/ui/components/button";

type Props = {
  items: readonly AdminWorkItem[];
  actorUserId: string;
  onOpenPreview: (item: AdminWorkItem) => void;
};

function itemMetaLine(item: AdminWorkItem, actorUserId: string): string {
  const parts = [item.domain, ownerLabel(item, actorUserId)];
  if (item.severity === "critical" || item.severity === "high") {
    parts.push(item.severity);
  }
  return parts.join(" · ");
}

export function WorkInboxCards({ items, actorUserId, onOpenPreview }: Props) {
  return (
    <ul className="divide-y divide-shell-stroke lg:hidden">
      {items.map((item) => {
        const accent = item.severity === "critical" || item.severity === "high";
        return (
          <li key={item.id}>
            <div
              className={`flex flex-col gap-3 py-4 ${accent ? `border-l-2 pl-3 ${severityAccentClass(item.severity)}` : ""}`}
            >
              <Button
                type="button"
                variant="ghost"
                size="link"
                className="h-auto w-full justify-start whitespace-normal px-0 py-0 text-left hover:bg-transparent"
                onClick={() => onOpenPreview(item)}
              >
                <p className="font-headline text-sm font-medium text-on-surface">{item.title}</p>
                {item.subtitle ? (
                  <p className="mt-0.5 text-xs text-on-surface-variant">{item.subtitle}</p>
                ) : null}
                <p className="mt-1 font-body text-xs text-on-surface-variant">
                  {itemMetaLine(item, actorUserId)}
                </p>
                <div className="mt-1">
                  <AdminTableDateTimeCell
                    iso={item.dueAt ?? item.createdAt}
                    mode="deadline"
                    className="inline-block"
                  />
                </div>
              </Button>
              <WorkInboxRowActions item={item} layout="inline" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
