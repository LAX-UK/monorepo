import { StaffDateTimeField } from "@/components/admin/forms/staff-form-fields";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { FieldRow, FormSection } from "@auction/staff-ui";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  isSaleroom: boolean;
};

export function ScheduleTimesSection({ form, isDraft, isSaleroom }: Props) {
  const f = { control: form.control, formId: SALE_FORM_ID, disabled: !isDraft } as const;
  return (
    <FormSection
      title="Schedule"
      description={
        isSaleroom
          ? "The saleroom's opening and closing times. Every lot in the sale takes these times."
          : "When the sale opens and closes, and when bidders can first preview it."
      }
    >
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
