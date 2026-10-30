"use client";

import type { AuditDetailValue } from "@/lib/admin/audit/audit-event-detail";
import type { AuditLogRowModel } from "@/lib/admin/audit/audit-log.vm";
import {
  DetailPanel,
  KeyValueList,
  PanelSection,
  StaffButton,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowRight, ArrowUpRight, LockKeyhole } from "lucide-react";
import Link from "next/link";

function Value({ value }: { value: AuditDetailValue }) {
  if (value.hidden) {
    return (
      <span className="inline-flex items-center gap-1 text-staff-muted">
        <LockKeyhole aria-hidden className="size-3.5" />
        Hidden for your role
      </span>
    );
  }
  return value.text ? <span>{value.text}</span> : <span className="text-staff-subtle">None</span>;
}

/** One audit event in full: who, what, on which record, what changed and what else it carries. */
export function AuditEventPanel({
  row,
  onClose,
}: {
  row: AuditLogRowModel | null;
  onClose: () => void;
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={row?.action ?? "Event"}
      description={row ? formatStaffDateTime(row.at, { zoneLabel: true }) : undefined}
      footer={
        row?.entity.href ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.entity.href}>Open {row.entity.typeLabel.toLowerCase()}</Link>
          </StaffButton>
        ) : null
      }
    >
      {row ? (
        <div className="flex flex-col gap-6">
          <PanelSection title="Event">
            <KeyValueList
              items={[
                {
                  label: "Who",
                  value: row.actor.email
                    ? `${row.actor.name} (${row.actor.email})`
                    : row.actor.name,
                },
                { label: "Event code", value: row.actionCode, copyValue: row.actionCode },
                { label: "Record", value: row.entity.typeLabel },
                { label: "Record ID", value: row.entity.id, copyValue: row.entity.id },
              ]}
            />
          </PanelSection>
          <PanelSection title="What changed">
            {row.detail.changes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {row.detail.changes.map((change) => (
                  <li
                    key={change.label}
                    className="rounded-staff-lg border border-staff-line bg-staff-surface p-3"
                  >
                    <p className="mb-2 text-staff-sm font-medium text-staff-fg">{change.label}</p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-staff-sm">
                      <span className="min-w-0 break-words rounded-staff-sm bg-staff-danger-bg px-2 py-1 text-staff-danger-fg">
                        <span className="sr-only">Before: </span>
                        <Value value={change.before} />
                      </span>
                      <ArrowRight aria-hidden className="size-4 text-staff-subtle" />
                      <span className="min-w-0 break-words rounded-staff-sm bg-staff-success-bg px-2 py-1 text-staff-success-fg">
                        <span className="sr-only">After: </span>
                        <Value value={change.after} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-staff-sm text-staff-muted">This event records no field changes.</p>
            )}
          </PanelSection>
          {row.detail.facts.length > 0 ? (
            <PanelSection title="Details">
              <KeyValueList
                items={row.detail.facts.map((fact) => ({
                  label: fact.label,
                  value: <Value value={fact.value} />,
                  ...(fact.copyValue ? { copyValue: fact.copyValue } : {}),
                }))}
              />
            </PanelSection>
          ) : null}
        </div>
      ) : null}
    </DetailPanel>
  );
}
