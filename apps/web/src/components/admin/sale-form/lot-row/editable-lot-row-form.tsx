"use client";

import {
  StaffDateTimeField,
  StaffEntityField,
  StaffEntityMultiField,
  StaffEnumField,
  StaffMoneyField,
  StaffTextField,
  staffFormSummaryErrors,
} from "@/components/admin/forms/staff-form-fields";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import {
  artistOption,
  searchArtistOptions,
  searchLegalEntityOptions,
} from "@/lib/admin/pickers/staff-entity-search";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  scheduleOutOfSyncBadge,
  updateLotScheduleLabel,
} from "@/lib/admin/sale-setup";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import {
  FieldRow,
  FormActions,
  FormErrorSummary,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type { ArtistProfile, CategoryNode, LotAuctionType } from "@auction/types";
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";

const ROW_FIELD_ORDER = [
  "title",
  "sellerLegalEntityId",
  "categoryIds",
  "auctionType",
  "startingPrice",
  "startTime",
  "endTime",
  "artistId",
];

type EditableLotRowFormProps = {
  row: SaleSetupLotRowFormValues;
  rowIndex: number;
  ctx: SaleSetupLotRowContext;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  readOnly: boolean;
  form: UseFormReturn<SaleSetupLotRowFormValues>;
  isDirty: boolean;
  isSaved: boolean;
  inheritsTiming: boolean;
  sellerDisplayName: string | undefined;
  pending: boolean;
  auctionTypeOptions: readonly LotAuctionType[];
  scheduleOutOfSync: boolean;
  /** Each failed save, for the row's error summary. */
  failedSaves?: number;
  onRemove: () => void;
  onSave: () => void;
  onUpdateSchedule: () => void;
};

/**
 * One lot added from the sale's Lots step: what it is, who sells it, its type, opening price and
 * times. Once saved, only its times can change here; the rest is edited on the lot.
 */
export function EditableLotRowForm({
  row,
  rowIndex,
  ctx,
  categories,
  artists,
  englishOnlyAuctionsLocked,
  readOnly,
  form,
  isDirty,
  isSaved,
  inheritsTiming,
  sellerDisplayName,
  pending,
  auctionTypeOptions,
  scheduleOutOfSync,
  failedSaves = 0,
  onRemove,
  onSave,
  onUpdateSchedule,
}: EditableLotRowFormProps) {
  const f = { control: form.control, formId: `sale-lot-${rowIndex}` } as const;
  const locked = readOnly || isSaved;
  const sellerId = useWatch({ control: form.control, name: "sellerLegalEntityId" });
  const artistId = useWatch({ control: form.control, name: "artistId" });
  const categoryOptions = useMemo(() => categoryPickerOptions(categories), [categories]);
  const known = artistId ? artists.find((artist) => artist.id === artistId) : null;

  return (
    <Section
      title={`Lot ${rowIndex + 1}`}
      action={
        <span className="flex flex-wrap items-center gap-2">
          {scheduleOutOfSync ? (
            <StatusBadge tone="warning">{scheduleOutOfSyncBadge()}</StatusBadge>
          ) : null}
          {isSaved ? (
            <StatusBadge tone={isDirty ? "warning" : "success"}>
              {isDirty ? "Unsaved changes" : "Saved"}
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">Not saved</StatusBadge>
          )}
          {!readOnly && !isSaved ? (
            <StaffButton
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove lot ${rowIndex + 1}`}
              icon={<Trash2 aria-hidden />}
              onClick={onRemove}
            />
          ) : null}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <FormErrorSummary
          errors={staffFormSummaryErrors(form.formState.errors, f.formId, ROW_FIELD_ORDER)}
          focusKey={failedSaves}
        />
        {form.formState.errors.root?.message ? (
          <Notice tone="danger" alert title="The lot was not saved">
            {form.formState.errors.root.message}
          </Notice>
        ) : null}
        <StaffTextField {...f} name="title" label="Title" disabled={locked} />
        <StaffEntityField
          {...f}
          name="sellerLegalEntityId"
          label="Seller"
          disabled={locked}
          search={searchLegalEntityOptions}
          selected={
            sellerId && sellerDisplayName?.trim()
              ? { id: sellerId, label: sellerDisplayName.trim() }
              : null
          }
          placeholder="Choose a seller"
          searchPlaceholder="Search by organisation or name"
          emptyText="No legal entities match."
          onChanged={(option) =>
            form.setValue("sellerDisplayName", option?.label ?? "", {
              shouldDirty: true,
              shouldValidate: false,
            })
          }
        />
        <StaffEntityMultiField
          {...f}
          name="categoryIds"
          label="Categories"
          options={categoryOptions}
          placeholder="Add a category"
          searchPlaceholder="Search categories"
          emptyText="No categories match."
        />
        <FieldRow>
          <StaffEnumField<SaleSetupLotRowFormValues, LotAuctionType>
            {...f}
            name="auctionType"
            label="Lot type"
            disabled={locked || englishOnlyAuctionsLocked}
            options={auctionTypeOptions.map((type) => ({
              value: type,
              label: lotAuctionTypeLabel(type),
            }))}
          />
          <StaffMoneyField {...f} name="startingPrice" label="Starting price" disabled={locked} />
        </FieldRow>
        {inheritsTiming ? (
          <p className="text-staff-sm text-staff-muted">
            The lot takes the sale's opening and closing times.
          </p>
        ) : (
          <FieldRow>
            <StaffDateTimeField
              {...f}
              name="startTime"
              label="Bidding opens"
              disabled={readOnly}
              description={`The sale opens ${formatStaffDateTime(ctx.saleStartTime, { zoneLabel: true })}.`}
            />
            <StaffDateTimeField
              {...f}
              name="endTime"
              label="Bidding closes"
              disabled={readOnly}
              description={`The sale closes ${formatStaffDateTime(ctx.saleEndTime, { zoneLabel: true })}.`}
            />
          </FieldRow>
        )}
        <StaffEntityField
          {...f}
          name="artistId"
          label="Artist, maker or brand"
          optional
          disabled={locked}
          description="Needed before the lot goes live."
          search={searchArtistOptions}
          selected={known ? artistOption(known) : null}
          placeholder="Not attributed"
          searchPlaceholder="Type at least two letters"
          emptyText="No artists match. Add the artist from Artists first."
        />
        {!readOnly && !isSaved ? (
          <FormActions>
            <StaffButton type="button" variant="ghost" onClick={() => form.reset(row)}>
              Reset
            </StaffButton>
            <StaffButton type="button" variant="primary" loading={pending} onClick={onSave}>
              Save lot
            </StaffButton>
          </FormActions>
        ) : null}
        {!readOnly && isSaved && !inheritsTiming ? (
          <FormActions>
            {isDirty ? (
              <StaffButton type="button" variant="ghost" onClick={() => form.reset(row)}>
                Discard changes
              </StaffButton>
            ) : null}
            <StaffButton
              type="button"
              variant="secondary"
              loading={pending}
              onClick={onUpdateSchedule}
            >
              {updateLotScheduleLabel()}
            </StaffButton>
          </FormActions>
        ) : null}
      </div>
    </Section>
  );
}
