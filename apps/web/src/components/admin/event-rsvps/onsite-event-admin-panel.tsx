"use client";

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { OnsiteEventAdminActions } from "@/components/admin/event-rsvps/onsite-event-admin-actions";
import { OnsiteEventBreadcrumbs } from "@/components/admin/event-rsvps/onsite-event-breadcrumbs";
import { OnsiteEventRsvpTable } from "@/components/admin/event-rsvps/onsite-event-rsvp-table";
import { resendOnsiteEventPass } from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventRsvpAdminRow, OnsiteEventSegmentOption } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useEffect, useMemo, useState } from "react";

const RESEND_ALERT_MS = 8_000;

type Props = {
  slug: string;
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  micrositeUrl: string | null;
  saleId?: string | null;
  venueDayCounts?: {
    rsvped: number;
    galaCheckedIn: number;
    salePresent: number;
    paddled: number;
  } | null;
  rsvps: OnsiteEventRsvpAdminRow[];
  error?: string | null;
  /** When true, outer catalog shell owns breadcrumbs/header chrome. */
  chromeless?: boolean;
};

type ArrivalFilter = "all" | "pending" | "arrived";

export function OnsiteEventAdminPanel({
  slug,
  title,
  segmentOptions,
  micrositeUrl,
  saleId = null,
  venueDayCounts = null,
  rsvps,
  error,
  chromeless = false,
}: Props) {
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

  return (
    <div className="space-y-8">
      {!chromeless ? (
        <OnsiteEventBreadcrumbs slug={slug} eventTitle={title} current="rsvps" />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <OnsiteEventAdminActions
          slug={slug}
          title={title}
          micrositeUrl={micrositeUrl}
          saleId={saleId}
          arrivedCount={arrivedCount}
          totalCount={rsvps.length}
          venueDayCounts={venueDayCounts}
          onDownloadError={(message) => setDownloadError(message || null)}
        />
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

      <OnsiteEventRsvpTable
        rsvps={filteredRsvps}
        allRsvps={rsvps}
        segmentOptions={segmentOptions}
        filter={filter}
        onFilterChange={setFilter}
        resendingId={resendingId}
        onResendConfirm={(rsvpId, guestName) => setResendConfirm({ rsvpId, guestName })}
      />

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
