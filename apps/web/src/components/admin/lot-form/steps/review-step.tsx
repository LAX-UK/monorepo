"use client";

import { poundsStringToPence } from "@/components/admin/forms/staff-form-fields";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { readingZone } from "@/lib/forms/schemas/reading-zone";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type-presentation";
import { formatWhen } from "@auction/datetime";
import { Notice, ReviewSection, formatGbp, wallTimeToIso } from "@auction/staff-ui";
import type { CategoryNode, LotAuctionType, Sale } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  onEditStep: (stepIndex: number) => void;
  sales?: ReadonlyArray<Pick<Sale, "id" | "title">>;
  categories?: readonly CategoryNode[];
};

function money(value: string | null | undefined): string | null {
  const pence = poundsStringToPence(value ?? "");
  return pence == null ? null : formatGbp(pence);
}

/** A typed wall time in the sale's zone, written as the one date style with that zone's name. */
function saleTime(value: string | null | undefined, timeZone: string): string | null {
  const [day, time] = (value ?? "").split("T");
  const iso = day && time ? wallTimeToIso(day, time.slice(0, 5), timeZone) : null;
  return iso ? formatWhen(new Date(iso), timeZone, new Date()) : null;
}

function categoryNames(ids: readonly string[], nodes: readonly CategoryNode[]): string | null {
  const names = new Map<string, string>();
  const walk = (list: readonly CategoryNode[]) => {
    for (const node of list) {
      names.set(node.id, node.name);
      walk(node.children);
    }
  };
  walk(nodes);
  const found = ids.map((id) => names.get(id)).filter(Boolean);
  return found.length > 0 ? found.join(", ") : null;
}

/** Check your answers: each step's answers in plain words, with Change to go back to it. */
export function LotFormReviewStep({ form, onEditStep, sales = [], categories = [] }: Props) {
  const values = form.getValues();
  const sale = sales.find((item) => item.id === values.saleId) ?? null;
  return (
    <div className="flex flex-col gap-4">
      {values.saleId ? (
        <Notice tone="info" title="Published with its sale">
          {draftSaleLotPublishBanner()}
        </Notice>
      ) : null}
      <ReviewSection
        title="Identity"
        onChange={() => onEditStep(0)}
        items={[
          { label: "Title", value: values.title?.trim() || null },
          {
            label: "Lot type",
            value: values.auctionType
              ? lotAuctionTypeLabel(values.auctionType as LotAuctionType)
              : null,
          },
        ]}
      />
      <ReviewSection
        title="Sale and seller"
        onChange={() => onEditStep(1)}
        items={[
          { label: "Seller", value: values.sellerDisplayName?.trim() || null },
          {
            label: "Sale",
            value: sale?.title ?? (values.saleId ? "Chosen sale" : "Not in a sale"),
          },
          {
            label: "Lot number",
            value: values.lotNumber != null ? String(values.lotNumber) : null,
            numeric: true,
          },
        ]}
      />
      <ReviewSection
        title="Catalogue"
        onChange={() => onEditStep(2)}
        items={[
          { label: "Categories", value: categoryNames(values.categoryIds ?? [], categories) },
          { label: "Starting price", value: money(values.startingPrice), numeric: true },
          { label: "Reserve", value: money(values.reservePrice) ?? "No reserve", numeric: true },
          {
            label: "Bidding closes",
            value: saleTime(values.endTime, readingZone(values.timeZone)),
          },
          {
            label: "Photos",
            value: values.images?.length ? String(values.images.length) : "None yet",
            numeric: Boolean(values.images?.length),
          },
        ]}
      />
    </div>
  );
}
