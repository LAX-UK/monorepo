"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import {
  findLotsOutsideSaleWindow,
  parseSaleWindowFromForm,
} from "@/lib/admin/sale-lot-window-sync";
import { useMemo, useRef } from "react";
import { BuyerPremiumSection } from "./schedule-step/buyer-premium-section";
import { DeliveryModeField } from "./schedule-step/delivery-mode-field";
import { LotConflictAlert } from "./schedule-step/lot-conflict-alert";
import { ReadOnlyNotice } from "./schedule-step/read-only-notice";
import { ScheduleTimesSection } from "./schedule-step/schedule-times-section";
import { StreamUrlField } from "./schedule-step/stream-url-field";
import type { SaleScheduleStepProps } from "./schedule-step/types";
import { VenueLocationFields } from "./schedule-step/venue-location-fields";

export type { SaleScheduleStepProps, TierPreview } from "./schedule-step/types";

export function SaleScheduleStep({
  form,
  isDraft,
  isSaleroom,
  pending: _pending,
  fields,
  append,
  remove,
  tierBandPreview,
  formattedPreviewAddress,
  previewMapUrl,
  customMapUrl,
  postcodeIsValid,
  lots = [],
  lotsSetupHref,
  venues = [],
  streamUrlEditable,
  initialStreamUrl = "",
  streamUrlGateRef,
}: SaleScheduleStepProps) {
  const deliveryMode = form.watch("deliveryMode");
  const streamFieldEnabled = isSaleroom && (streamUrlEditable ?? isDraft);
  const streamBlurRef = useRef<(() => void) | null>(null);
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const lotConflicts = useMemo(() => {
    const window = parseSaleWindowFromForm({ deliveryMode, startTime, endTime });
    if (!window || lots.length === 0) return [];
    return findLotsOutsideSaleWindow(lots, window);
  }, [deliveryMode, endTime, lots, startTime]);
  const pendingWindow = parseSaleWindowFromForm({ deliveryMode, startTime, endTime });

  return (
    <>
      <LotConflictAlert
        lotConflicts={lotConflicts}
        pendingWindow={pendingWindow}
        {...(lotsSetupHref ? { lotsSetupHref } : {})}
      />

      <ReadOnlyNotice isDraft={isDraft} />

      <CatalogFormSection
        title="Delivery & venue"
        description="Online, hybrid, or onsite delivery; stream link and venue when applicable."
        collapsible={false}
      >
        <DeliveryModeField form={form} isDraft={isDraft} deliveryMode={deliveryMode} />

        {isSaleroom ? (
          <>
            <StreamUrlField
              form={form}
              streamFieldEnabled={streamFieldEnabled}
              initialStreamUrl={initialStreamUrl}
              streamBlurRef={streamBlurRef}
              {...(streamUrlGateRef ? { streamUrlGateRef } : {})}
            />

            <VenueLocationFields
              form={form}
              isDraft={isDraft}
              venues={venues}
              formattedPreviewAddress={formattedPreviewAddress}
              previewMapUrl={previewMapUrl}
              customMapUrl={customMapUrl}
              postcodeIsValid={postcodeIsValid}
            />
          </>
        ) : null}
      </CatalogFormSection>

      <ScheduleTimesSection form={form} isDraft={isDraft} isSaleroom={isSaleroom} />

      <BuyerPremiumSection
        form={form}
        isDraft={isDraft}
        fields={fields}
        append={append}
        remove={remove}
        tierBandPreview={tierBandPreview}
      />
    </>
  );
}
