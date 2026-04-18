import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import {
  submitForReviewAction,
  updateSubmissionAction,
  withdrawSubmissionAction,
} from "@/lib/actions/submissions";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getSubmissionForUser } from "@/lib/data/http/submissions.server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const s = await getSubmissionForUser(id);
  if (!s) notFound();

  const catReader = await getServerCategoryReader();
  const allCats = await catReader.list();
  const categories = allCats.filter((c) => c.parentId == null);
  const editable = s.status === "draft";
  const canSubmit = s.status === "draft";
  const canWithdraw = s.status === "draft" || s.status === "submitted";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Submissions
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <DisplayHeading as="h1" className="text-3xl">
          {s.title}
        </DisplayHeading>
        <SubmissionStatusBadge status={s.status} />
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {!editable ? (
        <div className="space-y-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant">
          <p>{s.description ?? "No description."}</p>
          {s.rejectionReason ? (
            <p className="text-error">
              <span className="font-label text-xs uppercase tracking-widest">Reason</span>
              <br />
              {s.rejectionReason}
            </p>
          ) : null}
          {s.reviewNotes ? (
            <p>
              <span className="font-label text-xs uppercase tracking-widest">Reviewer notes</span>
              <br />
              {s.reviewNotes}
            </p>
          ) : null}
          {s.convertedLotId ? (
            <p>
              View listing:{" "}
              <Link href={`/artwork/${s.convertedLotId}`} className="text-primary underline">
                Open artwork page
              </Link>
            </p>
          ) : null}
          <p className="text-xs">
            Image URLs: {s.images.length ? s.images.join(", ") : "None listed."}
          </p>
        </div>
      ) : (
        <form action={updateSubmissionAction} className="space-y-8">
          <input type="hidden" name="submissionId" value={s.id} />
          <div>
            <label htmlFor="title" className="mb-2 block">
              <LabelCaps>Title</LabelCaps>
            </label>
            <UnderlineInput id="title" name="title" required defaultValue={s.title} />
          </div>
          <TextareaField
            id="description"
            name="description"
            label="Description"
            rows={5}
            defaultValue={s.description ?? ""}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="medium" className="mb-2 block">
                <LabelCaps>Medium</LabelCaps>
              </label>
              <UnderlineInput id="medium" name="medium" defaultValue={s.medium ?? ""} />
            </div>
            <div>
              <label htmlFor="dimensions" className="mb-2 block">
                <LabelCaps>Dimensions</LabelCaps>
              </label>
              <UnderlineInput id="dimensions" name="dimensions" defaultValue={s.dimensions ?? ""} />
            </div>
          </div>
          <SelectField
            id="categoryId"
            label="Category"
            name="categoryId"
            required
            defaultValue={s.categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextareaField
            id="images"
            name="images"
            label="Image URLs (one per line)"
            rows={4}
            defaultValue={s.images.join("\n")}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="askingPrice" className="mb-2 block">
                <LabelCaps>Asking price</LabelCaps>
              </label>
              <UnderlineInput
                id="askingPrice"
                name="askingPrice"
                defaultValue={s.askingPrice ?? ""}
              />
            </div>
            <div>
              <label htmlFor="reservePrice" className="mb-2 block">
                <LabelCaps>Reserve</LabelCaps>
              </label>
              <UnderlineInput
                id="reservePrice"
                name="reservePrice"
                defaultValue={s.reservePrice ?? ""}
              />
            </div>
          </div>
          <TextareaField
            id="submitterNotes"
            name="submitterNotes"
            label="Notes for reviewers"
            rows={3}
            defaultValue={s.submitterNotes ?? ""}
          />
          <Button type="submit" variant="secondary">
            Save changes
          </Button>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        {canSubmit ? (
          <form action={submitForReviewAction}>
            <input type="hidden" name="submissionId" value={s.id} />
            <Button type="submit">Submit for review</Button>
          </form>
        ) : null}
        {canWithdraw ? (
          <form action={withdrawSubmissionAction}>
            <input type="hidden" name="submissionId" value={s.id} />
            <Button type="submit" variant="secondary">
              Withdraw
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
