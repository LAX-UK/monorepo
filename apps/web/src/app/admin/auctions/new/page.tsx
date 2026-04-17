import { UnderlineInput } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { adminCreateAuctionAction } from "@/lib/actions/admin";
import Link from "next/link";

export default async function AdminNewAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/admin/auctions"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Auctions
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        New auction
      </DisplayHeading>
      {error ? (
        <div
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form action={adminCreateAuctionAction} className="space-y-8">
        <div>
          <label htmlFor="title" className="mb-2 block">
            <LabelCaps>Title</LabelCaps>
          </label>
          <UnderlineInput id="title" name="title" required placeholder="Lot title" />
        </div>

        <TextareaField id="description" name="description" label="Description" rows={5} />

        <SelectField
          id="auctionType"
          label="Auction type"
          name="auctionType"
          required
          options={[
            { value: "english", label: "English" },
            { value: "dutch", label: "Dutch" },
            { value: "sealed", label: "Sealed bid" },
            { value: "buy_it_now", label: "Buy it now" },
          ]}
          defaultValue="english"
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="startingPrice" className="mb-2 block">
              <LabelCaps>Starting price</LabelCaps>
            </label>
            <UnderlineInput id="startingPrice" name="startingPrice" required placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="reservePrice" className="mb-2 block">
              <LabelCaps>Reserve (optional)</LabelCaps>
            </label>
            <UnderlineInput id="reservePrice" name="reservePrice" placeholder="0.00" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="buyNowPrice" className="mb-2 block">
              <LabelCaps>Buy now price (optional)</LabelCaps>
            </label>
            <UnderlineInput id="buyNowPrice" name="buyNowPrice" placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="buyerPremiumRate" className="mb-2 block">
              <LabelCaps>Buyer premium (0–1)</LabelCaps>
            </label>
            <UnderlineInput id="buyerPremiumRate" name="buyerPremiumRate" placeholder="0.25" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="minBidIncrement" className="mb-2 block">
              <LabelCaps>Min bid increment</LabelCaps>
            </label>
            <UnderlineInput id="minBidIncrement" name="minBidIncrement" placeholder="1.00" />
          </div>
          <div>
            <label htmlFor="categoryId" className="mb-2 block">
              <LabelCaps>Category ID (UUID, optional)</LabelCaps>
            </label>
            <UnderlineInput id="categoryId" name="categoryId" placeholder="" />
          </div>
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

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="dutchDecrementAmount" className="mb-2 block">
              <LabelCaps>Dutch decrement amount (optional)</LabelCaps>
            </label>
            <UnderlineInput id="dutchDecrementAmount" name="dutchDecrementAmount" />
          </div>
          <div>
            <label htmlFor="dutchDecrementIntervalMs" className="mb-2 block">
              <LabelCaps>Dutch interval ms (optional)</LabelCaps>
            </label>
            <UnderlineInput
              id="dutchDecrementIntervalMs"
              name="dutchDecrementIntervalMs"
              placeholder="60000"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95"
        >
          Create draft
        </button>
      </form>
    </div>
  );
}
