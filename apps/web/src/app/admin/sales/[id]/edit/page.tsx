import { UnderlineInput } from "@/components/ui/input";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { adminUpdateSaleAction } from "@/lib/actions/admin-sales";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import Link from "next/link";
import { notFound } from "next/navigation";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminEditSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();
  const { sale } = bundle;
  if (sale.status !== "draft") {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-on-surface-variant">Only draft sales can be edited.</p>
        <Link href={`/admin/sales/${id}`} className="text-primary underline">
          Back to sale
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/admin/sales/${id}`}
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sale
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Edit sale
      </DisplayHeading>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <form action={adminUpdateSaleAction} className="space-y-8">
        <input type="hidden" name="saleId" value={sale.id} />
        <div>
          <label htmlFor="title" className="mb-2 block">
            <LabelCaps>Title</LabelCaps>
          </label>
          <UnderlineInput id="title" name="title" required defaultValue={sale.title} />
        </div>
        <TextareaField
          id="description"
          name="description"
          label="Description"
          rows={4}
          defaultValue={sale.description ?? ""}
        />
        <TextareaField
          id="coverImages"
          name="coverImages"
          label="Cover image URLs (one per line)"
          rows={3}
          defaultValue={sale.coverImages.join("\n")}
        />
        <div>
          <label htmlFor="categoryId" className="mb-2 block">
            <LabelCaps>Theme category ID (optional)</LabelCaps>
          </label>
          <UnderlineInput id="categoryId" name="categoryId" defaultValue={sale.categoryId ?? ""} />
        </div>
        <div>
          <label htmlFor="deliveryMode" className="mb-2 block">
            <LabelCaps>Saleroom delivery</LabelCaps>
          </label>
          <select
            id="deliveryMode"
            name="deliveryMode"
            defaultValue={sale.deliveryMode}
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
            defaultValue={sale.streamUrl ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <p className="mt-2 font-body text-xs text-on-surface-variant">
            Allowed: YouTube, Vimeo, Twitch, Cloudflare Stream. Clear for onsite-only.
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
              defaultValue={toLocalInput(sale.startTime)}
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
              defaultValue={toLocalInput(sale.endTime)}
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
            defaultValue={sale.previewStartTime ? toLocalInput(sale.previewStartTime) : ""}
            className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
          />
        </div>
        <div>
          <label htmlFor="buyerPremiumRate" className="mb-2 block">
            <LabelCaps>Buyer premium</LabelCaps>
          </label>
          <UnderlineInput
            id="buyerPremiumRate"
            name="buyerPremiumRate"
            defaultValue={sale.buyerPremiumRate}
          />
        </div>
        <TextareaField
          id="terms"
          name="terms"
          label="Terms"
          rows={4}
          defaultValue={sale.terms ?? ""}
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary"
        >
          Save
        </button>
      </form>
    </div>
  );
}
