"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { RhfLegalEntityPicker } from "@/components/ui/rhf-legal-entity-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  fieldTierSuffix,
  scheduleOutOfSyncBadge,
  updateLotScheduleLabel,
} from "@/lib/admin/sale-setup";
import { applySellerLegalEntitySelection } from "@/lib/admin/seller-legal-entity-form";
import { formatDateTime } from "@/lib/ui/format";
import type { ArtistProfile, CategoryNode, LotAuctionType } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { CheckCircle2, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

function chipFromArtists(artists: ArtistProfile[], id: string | null): ArtistChipModel | null {
  if (!id) return null;
  const a = artists.find((x) => x.id === id);
  if (!a?.kind || !a.status) return null;
  return {
    id: a.id,
    displayName: a.displayName,
    slug: a.slug,
    kind: a.kind,
    status: a.status,
  };
}

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
  onRemove: () => void;
  onSave: () => void;
  onUpdateSchedule: () => void;
};

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
  onRemove,
  onSave,
  onUpdateSchedule,
}: EditableLotRowFormProps) {
  return (
    <Form {...form}>
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-headline text-base text-on-surface">
            Lot {rowIndex + 1}
            {isSaved ? (
              <span className="ml-2 inline-flex items-center gap-1 font-body text-xs text-primary">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Saved
              </span>
            ) : (
              <span className="ml-2 font-body text-xs text-warning">Unsaved</span>
            )}
            {isSaved && isDirty ? (
              <span className="ml-2 font-body text-xs text-warning">Unsaved changes</span>
            ) : null}
            {scheduleOutOfSync ? (
              <span className="ml-2 font-body text-xs text-warning">
                {scheduleOutOfSyncBadge()}
              </span>
            ) : null}
          </p>
          {!readOnly && !isSaved ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove row"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Title{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput
                    {...field}
                    disabled={readOnly || isSaved}
                    placeholder="Lot title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sellerLegalEntityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Seller{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <RhfLegalEntityPicker
                  value={field.value || null}
                  displayLabel={sellerDisplayName?.trim() || null}
                  onChange={(id, entityRow) =>
                    applySellerLegalEntitySelection(
                      field.onChange,
                      (name) =>
                        form.setValue("sellerDisplayName", name, {
                          shouldDirty: true,
                          shouldValidate: false,
                        }),
                      id,
                      entityRow,
                    )
                  }
                  disabled={readOnly || isSaved}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Categories{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <CategoryPicker
                    categories={categories}
                    value={field.value}
                    onChange={field.onChange}
                    multiple
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="auctionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Auction type{fieldTierSuffix("required")}</LabelCaps>
                  </FormLabel>
                  <RhfSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={readOnly || isSaved || englishOnlyAuctionsLocked}
                    options={auctionTypeOptions.map((t) => ({
                      value: t,
                      label: t.replace(/_/g, " "),
                    }))}
                    triggerClassName="w-full font-body text-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Starting price{fieldTierSuffix("required")}</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} disabled={readOnly || isSaved} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!inheritsTiming ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <LabelCaps>Lot opens{fieldTierSuffix("required")}</LabelCaps>
                      </FormLabel>
                      <RhfDateTimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={readOnly}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <LabelCaps>Lot closes{fieldTierSuffix("required")}</LabelCaps>
                      </FormLabel>
                      <RhfDateTimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={readOnly}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="font-body text-xs text-on-surface-variant">
                Sale runs {formatDateTime(ctx.saleStartTime)} – {formatDateTime(ctx.saleEndTime)}{" "}
                (London time). Lot times must fall within this window.
              </p>
            </div>
          ) : (
            <p className="font-body text-xs text-on-surface-variant">
              Lot times match the sale schedule automatically for onsite sales.
            </p>
          )}

          <FormField
            control={form.control}
            name="artistId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Artist{fieldTierSuffix("optional")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <ArtistPicker
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id)}
                    selected={chipFromArtists(artists, field.value ?? null)}
                    disabled={readOnly || isSaved}
                    helpText="Needed before going live if you attribute a new artist who needs approval."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!readOnly && !isSaved ? (
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                loading={pending}
                onClick={onSave}
                className="min-h-11 w-full sm:w-auto"
              >
                Save lot
              </LoadingButton>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => form.reset(row)}
              >
                Reset row
              </Button>
            </div>
          ) : null}
          {!readOnly && isSaved && !inheritsTiming ? (
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                loading={pending}
                onClick={onUpdateSchedule}
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
              >
                {updateLotScheduleLabel()}
              </LoadingButton>
              {isDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => form.reset(row)}
                >
                  Discard changes
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Form>
  );
}
