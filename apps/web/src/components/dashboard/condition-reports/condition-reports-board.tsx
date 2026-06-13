"use client";

import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { BuyerConditionReportRequestVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ExternalLink, FileDown } from "lucide-react";
import Link from "next/link";

type Props = {
  rows: BuyerConditionReportRequestVM[];
  className?: string;
};

function StatusPill({ label, tone }: { label: string; tone: "neutral" | "primary" | "warn" }) {
  const tones = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    primary: "bg-primary-container/30 text-primary",
    warn: "bg-lot-orange/15 text-lot-orange",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}

function statusTone(
  status: BuyerConditionReportRequestVM["status"],
): "neutral" | "primary" | "warn" {
  if (status === "fulfilled") return "primary";
  if (status === "declined") return "warn";
  return "neutral";
}

export function ConditionReportsBoard({ rows, className }: Props) {
  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        title="No condition report requests yet"
        description="When you request a specialist report on a live lot, it will appear here with status and download links."
        action={
          <Button asChild variant="outline">
            <Link href="/search">Browse lots</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="hidden md:block">
        <Surface className="overflow-hidden p-0">
          <table className="w-full text-left font-body text-sm">
            <thead className="border-b border-outline-variant/30 bg-surface-container-high/50">
              <tr>
                <th className="px-4 py-3 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Lot
                </th>
                <th className="px-4 py-3 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Status
                </th>
                <th className="px-4 py-3 font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Requested
                </th>
                <th className="px-4 py-3 text-right font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={row.lotHref} className="font-medium text-link hover:underline">
                      {row.lotTitle}
                    </Link>
                    {row.lotNumberLabel ? (
                      <p className="text-xs text-on-surface-variant">{row.lotNumberLabel}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={row.statusLabel} tone={statusTone(row.status)} />
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{row.requestedAtLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={row.lotHref}>
                          <ExternalLink className="size-3.5" aria-hidden />
                          View lot
                        </Link>
                      </Button>
                      {row.downloadUrl ? (
                        <Button asChild size="sm">
                          <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                            <FileDown className="size-3.5" aria-hidden />
                            PDF
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Surface className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={row.lotHref} className="font-medium text-link hover:underline">
                    {row.lotTitle}
                  </Link>
                  {row.lotNumberLabel ? (
                    <p className="text-xs text-on-surface-variant">{row.lotNumberLabel}</p>
                  ) : null}
                </div>
                <StatusPill label={row.statusLabel} tone={statusTone(row.status)} />
              </div>
              <p className="text-xs text-on-surface-variant">Requested {row.requestedAtLabel}</p>
              {row.responseNote && row.status === "declined" ? (
                <p className="text-sm text-on-surface-variant">{row.responseNote}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="min-h-10">
                  <Link href={row.lotHref}>View lot</Link>
                </Button>
                {row.downloadUrl ? (
                  <Button asChild size="sm" className="min-h-10">
                    <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                      Download PDF
                    </a>
                  </Button>
                ) : null}
              </div>
            </Surface>
          </li>
        ))}
      </ul>
    </div>
  );
}
