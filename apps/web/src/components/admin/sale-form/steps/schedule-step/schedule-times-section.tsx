import { StaffDateTimeField } from "@/components/admin/forms/staff-form-fields";
import { StaffTimeZoneField } from "@/components/admin/forms/staff-time-zone-field";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { timesAreInLabel } from "@auction/datetime";
import { FieldRow, FormSection } from "@auction/staff-ui";
import {
  DEFAULT_SALE_TIME_ZONE,
  SALE_TIME_ZONE_LOCKED_MESSAGE,
  saleTimeZoneProblem,
} from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";
import { useVenueCountryTimeZone } from "../../use-venue-country-time-zone";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  isSaleroom: boolean;
};

export function ScheduleTimesSection({ form, isDraft, isSaleroom }: Props) {
  useVenueCountryTimeZone(form, isDraft && isSaleroom);
  const chosen = form.watch("timeZone");
  const zone = saleTimeZoneProblem(chosen) ? DEFAULT_SALE_TIME_ZONE : chosen;
  const f = {
    control: form.control,
    formId: SALE_FORM_ID,
    disabled: !isDraft,
    timeZone: zone,
  } as const;
  return (
    <FormSection
      title="Schedule"
      description={
        isSaleroom
          ? "The saleroom's opening and closing times. Every lot in the sale takes these times."
          : "When the sale opens and closes, and when bidders can first preview it."
      }
    >
      <StaffTimeZoneField
        control={form.control}
        name="timeZone"
        formId={SALE_FORM_ID}
        label="Time zone"
        description={`${timesAreInLabel(zone, new Date())}. Changing the zone keeps the times you typed and reads them in the new zone.`}
        disabled={!isDraft}
        lockedReason={`${timesAreInLabel(zone, new Date())}. ${SALE_TIME_ZONE_LOCKED_MESSAGE}`}
      />
      <FieldRow>
        <StaffDateTimeField {...f} name="startTime" label="Opens" />
        <StaffDateTimeField {...f} name="endTime" label="Closes" />
      </FieldRow>
      <StaffDateTimeField
        {...f}
        name="previewStartTime"
        label="Preview opens"
        optional
        description="Bidders can browse the lots from this time, before bidding opens."
      />
    </FormSection>
  );
}
