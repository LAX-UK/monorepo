"use client";

import { getLotCatalogueProfile } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";
import { CatalogueBiddingSection } from "./catalogue/catalogue-bidding-section";
import { CatalogueDetailsSection } from "./catalogue/catalogue-details-section";
import { CatalogueImagesSection } from "./catalogue/catalogue-images-section";
import { CataloguePricingSection } from "./catalogue/catalogue-pricing-section";
import { CatalogueScheduleSection } from "./catalogue/catalogue-schedule-section";
import { LotTypeSummaryBanner } from "./catalogue/lot-type-summary-banner";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  sales: Pick<Sale, "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime">[];
  showArtistField?: boolean;
  onEditLotType?: () => void;
};

export function LotCatalogueStep({
  form,
  categories,
  artists,
  sales,
  showArtistField = true,
  onEditLotType,
}: Props) {
  const auctionType = form.watch("auctionType");
  const profile = getLotCatalogueProfile(auctionType);

  return (
    <div className="space-y-8">
      <LotTypeSummaryBanner profile={profile} onEditLotType={onEditLotType} />
      <CataloguePricingSection form={form} fields={profile.fields} />
      <CatalogueBiddingSection form={form} fields={profile.fields} />
      <CatalogueScheduleSection form={form} fields={profile.fields} sales={sales} />
      <CatalogueDetailsSection
        form={form}
        categories={categories}
        artists={artists}
        showArtistField={showArtistField}
        fields={profile.fields}
      />
      <CatalogueImagesSection form={form} fields={profile.fields} />
    </div>
  );
}
