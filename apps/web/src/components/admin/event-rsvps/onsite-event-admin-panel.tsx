"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { OnsiteEventBreadcrumbs } from "@/components/admin/event-rsvps/onsite-event-breadcrumbs";
import { OnsiteEventRsvpMobileCards } from "@/components/admin/event-rsvps/onsite-event-rsvp-mobile-cards";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { resendOnsiteEventPass } from "@/lib/data/http/onsite-event-check-in.client";
import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Surface } from "@auction/ui/components/surface";
import { Download, ExternalLink, Mail, ScanLine } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const RESEND_ALERT_MS = 8_000;

type Props = {
  slug: string;
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  micrositeUrl: string | null;
  rsvps: OnsiteEventRsvpAdminRow[];
  error?: string | null;
};

type ArrivalFilter = "all" | "pending" | "arrived";

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
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [filter, setFilter] = useState<ArrivalFilter>("all");
  const [resendConfirm, setResendConfirm] = useState<{ rsvpId: string; guestName: string } | null>(
    null,
  );

  const arrivedCount = useMemo(
    () => rsvps.filter((row) => row.checkedInAt != null).length,
    [rsvps],
  );

  const filteredRsvps = useMemo(() => {
    if (filter === "pending") return rsvps.filter((row) => !row.checkedInAt);
    if (filter === "arrived") return rsvps.filter((row) => row.checkedInAt);
    return rsvps;
  }, [filter, rsvps]);

  useEffect(() => {
    if (!resendMessage) return;
    const timer = window.setTimeout(() => setResendMessage(null), RESEND_ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [resendMessage]);

  async function resendPass(rsvpId: string) {
    setResendingId(rsvpId);
    setResendMessage(null);
    setResendSuccess(false);
    try {
      const rotated = await resendOnsiteEventPass(slug, rsvpId);
      setResendSuccess(true);
      setResendMessage(
        rotated
          ? "Pass resent with a new link (previous pass is no longer valid)."
          : "Pass resent to the guest's email.",
      );
    } catch (e) {
      setResendSuccess(false);
      setResendMessage(e instanceof Error ? e.message : "Could not resend pass");
    } finally {
      setResendingId(null);
    }
  }

  async function downloadCsv() {
    setDownloading(true);
    setDownloadError(null);
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
      setDownloadError(e instanceof Error ? e.message : "Could not download CSV");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      <OnsiteEventBreadcrumbs slug={slug} eventTitle={title} current="rsvps" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
            {title}
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            RSVPs for this event · {arrivedCount} / {rsvps.length} arrived
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
        </div>
      </div>

      {error ? <AdminListAlert>{error}</AdminListAlert> : null}
      {downloadError ? <AdminListAlert>{downloadError}</AdminListAlert> : null}
      {resendMessage ? (
        <AdminListAlert
          title={resendSuccess ? "Pass sent" : "Something went wrong"}
          variant={resendSuccess ? "default" : "destructive"}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span>{resendMessage}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => setResendMessage(null)}
            >
              Dismiss
            </Button>
          </div>
        </AdminListAlert>
      ) : null}

      <Surface className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">RSVPs ({filteredRsvps.length})</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "arrived"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : value === "pending" ? "Not arrived" : "Arrived"}
              </Button>
            ))}
          </div>
        </div>
        {filteredRsvps.length === 0 ? (
          <AdminEmptyState
            title={rsvps.length === 0 ? "No RSVPs yet" : "No RSVPs in this view"}
            description={
              rsvps.length === 0
                ? "Responses will appear here once guests submit the form."
                : filter === "pending"
                  ? "Everyone on the list has already checked in."
                  : filter === "arrived"
                    ? "No guests have checked in yet."
                    : "Try a different filter."
            }
          />
        ) : (
          <>
            <OnsiteEventRsvpMobileCards
              rows={filteredRsvps}
              segmentOptions={segmentOptions}
              resendingId={resendingId}
              onResend={(rsvpId, guestName) => setResendConfirm({ rsvpId, guestName })}
            />
            <div className="hidden overflow-x-auto rounded-lg border border-border-hairline lg:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-border-hairline bg-surface-container-low/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Guest</th>
                    <th className="px-3 py-2 font-medium">Segment</th>
                    <th className="px-3 py-2 font-medium">Plus-one</th>
                    <th className="px-3 py-2 font-medium">Check-in</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th className="px-3 py-2 font-medium">Pass</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRsvps.map((row) => (
                    <tr key={row.id} className="border-b border-border-hairline last:border-0">
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{row.name}</p>
                        <p className="font-body text-xs text-on-surface-variant">{row.email}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {segmentLabel(segmentOptions, row.attendanceSegment)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {row.plusOne > 0
                          ? row.plusOneGuestName?.trim() || "Yes (+1)"
                          : "Just guest"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {row.checkedInAt ? (
                          <Badge variant="secondary">
                            Checked in {formatDateTime(row.checkedInAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not arrived</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top max-w-xs whitespace-pre-wrap text-on-surface-variant">
                        {row.notes?.trim() || "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resendingId === row.id}
                          onClick={() => setResendConfirm({ rsvpId: row.id, guestName: row.name })}
                        >
                          <Mail className="mr-2 size-3.5" />
                          {resendingId === row.id ? "Sending…" : "Resend pass"}
                        </Button>
                      </td>
                      <td className="px-3 py-3 align-top text-on-surface-variant whitespace-nowrap">
                        {formatDateTime(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>

      <ConfirmDialog
        open={resendConfirm != null}
        onOpenChange={(open) => {
          if (!open) setResendConfirm(null);
        }}
        title="Resend entry pass?"
        body={
          resendConfirm ? (
            <p>
              Send a new pass email to <strong>{resendConfirm.guestName}</strong>? If no stored
              token exists, a new pass link will be issued and the previous link will stop working.
            </p>
          ) : null
        }
        confirmLabel="Resend pass"
        tone="info"
        loading={resendingId != null}
        onConfirm={() => {
          if (!resendConfirm) return;
          const { rsvpId } = resendConfirm;
          void resendPass(rsvpId).finally(() => setResendConfirm(null));
        }}
      />
    </div>
  );
}
