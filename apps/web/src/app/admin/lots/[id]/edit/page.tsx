import { UnderlineInput } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { adminUpdateLotAction } from "@/lib/actions/admin";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminEditAuctionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const auction = await getAdminLotById(id).catch(() => null);
  if (!auction) notFound();
  if (auction.status !== "draft") {
    redirect(`/admin/lots/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/admin/lots/${id}`}
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Lot detail
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Edit draft
      </DisplayHeading>
      {error ? (
        <div
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form action={adminUpdateLotAction} className="space-y-8">
        <input type="hidden" name="lotId" value={id} />
        <div>
          <label htmlFor="title" className="mb-2 block">
            <LabelCaps>Title</LabelCaps>
          </label>
          <UnderlineInput id="title" name="title" required defaultValue={auction.title} />
        </div>

        <TextareaField
          id="description"
          name="description"
          label="Description"
          rows={5}
          defaultValue={auction.description ?? ""}
        />

        <SelectField
          id="auctionType"
          label="Lot type"
          name="auctionType"
          required
          defaultValue={auction.auctionType}
          options={[
            { value: "english", label: "English" },
            { value: "dutch", label: "Dutch" },
            { value: "sealed", label: "Sealed bid" },
            { value: "buy_it_now", label: "Buy it now" },
          ]}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="startingPrice" className="mb-2 block">
              <LabelCaps>Starting price</LabelCaps>
            </label>
            <UnderlineInput
              id="startingPrice"
              name="startingPrice"
              required
              defaultValue={auction.startingPrice}
            />
          </div>
          <div>
            <label htmlFor="reservePrice" className="mb-2 block">
              <LabelCaps>Reserve (optional)</LabelCaps>
            </label>
            <UnderlineInput
              id="reservePrice"
              name="reservePrice"
              defaultValue={auction.reservePrice ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="buyNowPrice" className="mb-2 block">
              <LabelCaps>Buy now (optional)</LabelCaps>
            </label>
            <UnderlineInput
              id="buyNowPrice"
              name="buyNowPrice"
              defaultValue={auction.buyNowPrice ?? ""}
            />
          </div>
          <div>
            <label htmlFor="buyerPremiumRate" className="mb-2 block">
              <LabelCaps>Buyer premium</LabelCaps>
            </label>
            <UnderlineInput
              id="buyerPremiumRate"
              name="buyerPremiumRate"
              defaultValue={auction.buyerPremiumRate}
            />
          </div>
        </div>

        <div>
          <label htmlFor="minBidIncrement" className="mb-2 block">
            <LabelCaps>Min bid increment</LabelCaps>
          </label>
          <UnderlineInput
            id="minBidIncrement"
            name="minBidIncrement"
            defaultValue={auction.minBidIncrement}
          />
        </div>

        <div>
          <label htmlFor="categoryId" className="mb-2 block">
            <LabelCaps>Category ID (optional)</LabelCaps>
          </label>
          <UnderlineInput
            id="categoryId"
            name="categoryId"
            defaultValue={auction.categoryId ?? ""}
          />
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
              defaultValue={toDatetimeLocalValue(auction.startTime)}
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
              defaultValue={toDatetimeLocalValue(auction.endTime)}
              className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="medium" className="mb-2 block">
              <LabelCaps>Medium</LabelCaps>
            </label>
            <UnderlineInput id="medium" name="medium" defaultValue={auction.medium ?? ""} />
          </div>
          <div>
            <label htmlFor="dimensions" className="mb-2 block">
              <LabelCaps>Dimensions</LabelCaps>
            </label>
            <UnderlineInput
              id="dimensions"
              name="dimensions"
              defaultValue={auction.dimensions ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="dutchDecrementAmount" className="mb-2 block">
              <LabelCaps>Dutch decrement</LabelCaps>
            </label>
            <UnderlineInput
              id="dutchDecrementAmount"
              name="dutchDecrementAmount"
              defaultValue={auction.dutchDecrementAmount ?? ""}
            />
          </div>
          <div>
            <label htmlFor="dutchDecrementIntervalMs" className="mb-2 block">
              <LabelCaps>Dutch interval ms</LabelCaps>
            </label>
            <UnderlineInput
              id="dutchDecrementIntervalMs"
              name="dutchDecrementIntervalMs"
              defaultValue={String(auction.dutchDecrementIntervalMs)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
