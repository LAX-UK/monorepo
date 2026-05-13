import { AppScreen } from "@/components/dashboard/dashboard-page";
import {
  adminDeclineConditionReportAction,
  adminFulfillConditionReportAction,
} from "@/lib/actions/admin";
import {
  type AdminConditionReportRequestRow,
  getAdminConditionReportRequests,
} from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { searchParams: Promise<{ error?: string }> };

function PendingRow({ row }: { row: AdminConditionReportRequestRow }) {
  return (
    <li className="rounded-lg border border-outline-variant/30 p-4">
      <div className="font-body text-sm">
        <p className="font-medium">
          <Link href={`/admin/lots/${row.lotId}`} className="text-primary hover:underline">
            {row.lotTitle ?? row.lotId}
          </Link>
        </p>
        <p className="text-secondary text-xs">
          From {row.requesterEmail ?? row.requestedByUserId} ·{" "}
          {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
        </p>
        {row.requestNote ? (
          <p className="mt-2 text-xs text-on-surface-variant">“{row.requestNote}”</p>
        ) : null}
      </div>
      <form
        action={adminFulfillConditionReportAction}
        className="mt-4 space-y-2 border-t border-outline-variant/20 pt-4"
      >
        <input type="hidden" name="requestId" value={row.id} />
        <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
          Publish to catalogue
        </p>
        <input
          name="summary"
          placeholder="Summary (public)"
          className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
        />
        <textarea
          name="details"
          placeholder="Details (public)"
          className="min-h-20 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
        />
        <input
          name="downloadUrl"
          placeholder="PDF URL (https://…)"
          className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
        />
        <textarea
          name="responseNote"
          placeholder="Internal note (optional)"
          className="min-h-16 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" className="min-h-9">
            Fulfill & publish
          </Button>
        </div>
      </form>
      <form action={adminDeclineConditionReportAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="requestId" value={row.id} />
        <textarea
          name="responseNote"
          placeholder="Decline reason (optional)"
          className="min-h-14 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="min-h-9 w-fit">
          Decline
        </Button>
      </form>
    </li>
  );
}

export default async function AdminConditionReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const err = sp.error;
  const { items } = await getAdminConditionReportRequests({
    status: "pending",
    limit: 80,
    offset: 0,
  });
  const pending = items.filter((r) => r.status === "pending" || r.status === "in_progress");

  return (
    <AppScreen className="max-w-3xl space-y-6">
      <PageHeader
        title="Condition report requests"
        description="Buyer-requested condition reports. Fulfilling publishes the PDF copy block on the public lot page."
        className="border-0 pb-0"
      />
      {err ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-body text-sm text-destructive">
          {err}
        </p>
      ) : null}
      {pending.length === 0 ? (
        <EmptyState title="Queue is clear" description="No pending condition report requests." />
      ) : (
        <ul className="space-y-4">
          {pending.map((row) => (
            <PendingRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </AppScreen>
  );
}
