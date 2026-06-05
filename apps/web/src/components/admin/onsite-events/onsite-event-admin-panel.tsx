"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";

type Props = {
  slug: string;
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  micrositeUrl: string | null;
  rsvps: OnsiteEventRsvpAdminRow[];
  error?: string | null;
};

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? fallback;
}

function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function OnsiteEventAdminPanel({
  slug,
  title,
  segmentOptions,
  micrositeUrl,
  rsvps,
  error,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadCsv() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await browserFetch(
        `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/rsvps/export`,
        { headers: { Accept: "text/csv" } },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename = parseFilename(res.headers.get("Content-Disposition"), `${slug}-rsvps.csv`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Could not download CSV");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl tracking-tight">{title}</h1>
          <p className="font-body text-sm text-on-surface-variant">RSVPs for this onsite event.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void downloadCsv()}
            disabled={downloading}
          >
            <Download className="mr-2 size-4" />
            {downloading ? "Preparing…" : "Download CSV"}
          </Button>
          {micrositeUrl ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={`${micrositeUrl}#rsvp`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" />
                Guest RSVP page
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <AdminListAlert>{error}</AdminListAlert> : null}
      {downloadError ? <AdminListAlert>{downloadError}</AdminListAlert> : null}

      <Surface className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">RSVPs ({rsvps.length})</h2>
        </div>
        {rsvps.length === 0 ? (
          <AdminEmptyState
            title="No RSVPs yet"
            description="Responses will appear here once guests submit the form."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-hairline">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border-hairline bg-surface-container-low/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Guest</th>
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 font-medium">Plus-one</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map((row) => (
                  <tr key={row.id} className="border-b border-border-hairline last:border-0">
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium">{row.name}</p>
                      <p className="font-body text-xs text-on-surface-variant">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {segmentLabel(segmentOptions, row.attendanceSegment)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.plusOne > 0 ? row.plusOneGuestName?.trim() || "Yes (+1)" : "Just guest"}
                    </td>
                    <td className="px-3 py-3 align-top max-w-xs whitespace-pre-wrap text-on-surface-variant">
                      {row.notes?.trim() || "—"}
                    </td>
                    <td className="px-3 py-3 align-top text-on-surface-variant whitespace-nowrap">
                      {formatDateTime(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
