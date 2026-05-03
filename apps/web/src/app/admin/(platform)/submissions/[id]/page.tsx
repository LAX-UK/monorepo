import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { ReviewSplitPane } from "@auction/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminSubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const record = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DisplayHeading as="h2" className="text-2xl md:text-3xl">
          {s.title}
        </DisplayHeading>
        <SubmissionStatusBadge status={s.status} />
      </div>
      <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm">
        <p>
          <span className="font-label text-xs uppercase tracking-widest text-secondary">
            Seller
          </span>{" "}
          {s.sellerId}
        </p>
        <p>{s.description ?? "—"}</p>
        <p className="text-on-surface-variant">
          Medium: {s.medium ?? "—"} · Dimensions: {s.dimensions ?? "—"}
        </p>
        <p className="text-on-surface-variant">
          Asking: {s.askingPrice ?? "—"} · Reserve: {s.reservePrice ?? "—"}
        </p>
        <div>
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Image URLs
          </p>
          {s.images.length === 0 ? (
            <p className="text-on-surface-variant">None</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-primary">
              {s.images.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noreferrer" className="break-all underline">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {s.submitterNotes ? (
          <p>
            <span className="font-label text-xs uppercase tracking-widest text-secondary">
              Seller notes
            </span>
            <br />
            {s.submitterNotes}
          </p>
        ) : null}
      </div>
      {s.status === "rejected" && s.rejectionReason ? (
        <p className="text-sm text-error">Rejected: {s.rejectionReason}</p>
      ) : null}
    </div>
  );

  const decision = <AdminSubmissionDecisionPanel submissionId={s.id} status={s.status} />;

  return (
    <div className="screen w-full space-y-6">
      <Link
        href="/admin/submissions"
        className="inline-flex min-h-11 items-center font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Queue
      </Link>

      <ReviewSplitPane
        recordTitle="Intake"
        decisionTitle="Decision"
        mobileStickyAction={
          <Link
            href="/admin/submissions"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container-low px-4 font-label text-xs uppercase tracking-widest text-on-surface hover:bg-surface-container-high/60"
          >
            Back to queue
          </Link>
        }
        record={record}
        decision={decision}
      />
    </div>
  );
}
