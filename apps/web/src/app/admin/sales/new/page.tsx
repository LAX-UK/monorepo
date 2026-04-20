import { UnderlineInput } from "@/components/ui/input";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { adminCreateSaleAction } from "@/lib/actions/admin-sales";
import Link from "next/link";

export default async function AdminNewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/admin/sales"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sales
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        New sale
      </DisplayHeading>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <form action={adminCreateSaleAction} className="space-y-8">
        <div>
          <label htmlFor="title" className="mb-2 block">
            <LabelCaps>Title</LabelCaps>
          </label>
          <UnderlineInput id="title" name="title" required />
        </div>
        <TextareaField id="description" name="description" label="Description" rows={4} />
        <TextareaField
          id="coverImages"
          name="coverImages"
          label="Cover image URLs (one per line)"
          rows={3}
          placeholder="https://..."
        />
        <div>
          <label htmlFor="categoryId" className="mb-2 block">
            <LabelCaps>Theme category ID (optional UUID)</LabelCaps>
          </label>
          <UnderlineInput id="categoryId" name="categoryId" placeholder="" />
        </div>
        <div>
          <label htmlFor="deliveryMode" className="mb-2 block">
            <LabelCaps>Saleroom delivery</LabelCaps>
          </label>
          <select
            id="deliveryMode"
            name="deliveryMode"
            defaultValue="onsite"
            className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
          >
            <option value="onsite">Onsite only</option>
            <option value="online">Online only</option>
            <option value="hybrid">Online + onsite (hybrid)</option>
          </select>
        </div>
        <div>
          <label htmlFor="streamUrl" className="mb-2 block">
            <LabelCaps>Stream URL (optional)</LabelCaps>
          </label>
          <UnderlineInput
            id="streamUrl"
            name="streamUrl"
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <p className="mt-2 font-body text-xs text-on-surface-variant">
            Allowed: YouTube, Vimeo, Twitch, Cloudflare Stream. Leave empty for onsite-only.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="startTime" className="mb-2 block">
              <LabelCaps>Start (local)</LabelCaps>
            </label>
            <input
              id="startTime"
              name="startTime"
              type="datetime-local"
              required
              className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="mb-2 block">
              <LabelCaps>End (local)</LabelCaps>
            </label>
            <input
              id="endTime"
              name="endTime"
              type="datetime-local"
              required
              className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="previewStartTime" className="mb-2 block">
            <LabelCaps>Preview start (optional)</LabelCaps>
          </label>
          <input
            id="previewStartTime"
            name="previewStartTime"
            type="datetime-local"
            className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
          />
        </div>
        <div>
          <label htmlFor="buyerPremiumRate" className="mb-2 block">
            <LabelCaps>Buyer premium (0–1)</LabelCaps>
          </label>
          <UnderlineInput id="buyerPremiumRate" name="buyerPremiumRate" placeholder="0.25" />
        </div>
        <TextareaField id="terms" name="terms" label="Terms of sale" rows={4} />
        <button
          type="submit"
          className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95"
        >
          Create draft sale
        </button>
      </form>
    </div>
  );
}
