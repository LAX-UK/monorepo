import { StaffDateTimeField } from "@/components/admin/forms/staff-form-fields";
import { StaffTimeZoneField } from "@/components/admin/forms/staff-time-zone-field";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { readingZone } from "@/lib/forms/schemas/reading-zone";
import { timesAreInLabel } from "@auction/datetime";
import { FieldRow, FormSection } from "@auction/staff-ui";
import { SALE_TIME_ZONE_LOCKED_MESSAGE, saleTimeZoneProblem } from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";
import { useVenueCountryTimeZone } from "../../use-venue-country-time-zone";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  /** The sale was announced once, so its zone is fixed even when it is a draft again. */
  timeZoneLocked?: boolean;
  isSaleroom: boolean;
};

export function ScheduleTimesSection({ form, isDraft, timeZoneLocked = false, isSaleroom }: Props) {
  const chosen = form.watch("timeZone");
  const usable = saleTimeZoneProblem(chosen) === null;
  const zone = readingZone(chosen);
  const locked = !isDraft || timeZoneLocked;
  useVenueCountryTimeZone(form, isDraft && !locked && isSaleroom);
  const f = {
    control: form.control,
    formId: SALE_FORM_ID,
    disabled: !isDraft,
    timeZone: zone,
  } as const;
  const zoneLine = usable ? `${timesAreInLabel(zone, new Date())}. ` : "";
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
        description={`${zoneLine}Changing the zone keeps the times you typed and reads them in the new zone.`}
        {...(locked ? { lockedReason: `${zoneLine}${SALE_TIME_ZONE_LOCKED_MESSAGE}` } : {})}
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
