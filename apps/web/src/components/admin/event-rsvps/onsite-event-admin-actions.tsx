"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { Button } from "@auction/ui/components/button";
import { Download, ExternalLink, ScanLine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  slug: string;
  title: string;
  micrositeUrl: string | null;
  saleId: string | null;
  arrivedCount: number;
  totalCount: number;
  venueDayCounts?: {
    rsvped: number;
    galaCheckedIn: number;
    salePresent: number;
    paddled: number;
  } | null;
  onDownloadError: (message: string) => void;
};

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? fallback;
}

export function OnsiteEventAdminActions({
  slug,
  title,
  micrositeUrl,
  saleId,
  arrivedCount,
  totalCount,
  venueDayCounts = null,
  onDownloadError,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  async function downloadCsv() {
    setDownloading(true);
    onDownloadError("");
    try {
      const res = await browserFetch(
        `${browserApiBase()}/admin/event-rsvps/${encodeURIComponent(slug)}/rsvps/export`,
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
      onDownloadError(e instanceof Error ? e.message : "Could not download CSV");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="space-y-1">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
          {title}
        </h1>
        <p className="font-body text-sm text-on-surface-variant">
          RSVPs for this event · {arrivedCount} / {totalCount} arrived
          {venueDayCounts ? (
            <>
              {" "}
              · Sale present {venueDayCounts.salePresent} · Paddled {venueDayCounts.paddled}
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" size="sm" asChild>
          <Link href={`/admin/event-rsvps/${encodeURIComponent(slug)}/check-in`}>
            <ScanLine className="mr-2 size-4" />
            Open check-in
          </Link>
        </Button>
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
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/admin/event-rsvps/${encodeURIComponent(slug)}/edit`}>Edit event</Link>
        </Button>
        {saleId ? (
          <>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/admin/sales/${encodeURIComponent(saleId)}/registrations#check-in`}>
                Sale check-in
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/admin/saleroom/${encodeURIComponent(saleId)}`}>Saleroom console</Link>
            </Button>
          </>
        ) : null}
      </div>
    </>
  );
}
