import { UnderlineInput } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { createSubmissionAction } from "@/lib/actions/submissions";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import Link from "next/link";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const catReader = await getServerCategoryReader();
  const allCats = await catReader.list();
  const categories = allCats.filter((c) => c.parentId == null);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Submissions
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Sell an item
      </DisplayHeading>
      <p className="font-body text-sm text-on-surface-variant">
        Provide accurate catalog information. Our team reviews every submission before a draft lot
        is created. Images: paste one image URL per line (upload API is available for testing at{" "}
        <code className="rounded bg-surface-container-high px-1">POST /uploads/image</code>).
      </p>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <form action={createSubmissionAction} className="space-y-8">
        <div>
          <label htmlFor="title" className="mb-2 block">
            <LabelCaps>Title</LabelCaps>
          </label>
          <UnderlineInput id="title" name="title" required placeholder="Work title" />
        </div>
        <TextareaField id="description" name="description" label="Description" rows={5} />
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="medium" className="mb-2 block">
              <LabelCaps>Medium (optional)</LabelCaps>
            </label>
            <UnderlineInput id="medium" name="medium" />
          </div>
          <div>
            <label htmlFor="dimensions" className="mb-2 block">
              <LabelCaps>Dimensions (optional)</LabelCaps>
            </label>
            <UnderlineInput id="dimensions" name="dimensions" />
          </div>
        </div>
        <SelectField
          id="categoryId"
          label="Category"
          name="categoryId"
          required
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextareaField
          id="images"
          name="images"
          label="Image URLs (one per line)"
          rows={4}
          placeholder="https://..."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="askingPrice" className="mb-2 block">
              <LabelCaps>Asking price (optional)</LabelCaps>
            </label>
            <p className="mb-2 font-body text-xs text-on-surface-variant">
              Shown only to reviewers for context; not displayed to bidders until published as a
              lot.
            </p>
            <UnderlineInput id="askingPrice" name="askingPrice" placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="reservePrice" className="mb-2 block">
              <LabelCaps>Reserve (optional)</LabelCaps>
            </label>
            <UnderlineInput id="reservePrice" name="reservePrice" placeholder="0.00" />
          </div>
        </div>
        <TextareaField
          id="submitterNotes"
          name="submitterNotes"
          label="Notes for reviewers"
          rows={3}
        />
        <button
          type="submit"
          className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95"
        >
          Save draft
        </button>
      </form>
    </div>
  );
}
