"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { AttachExistingLotReview } from "@/components/admin/attach-existing-lot-review";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { RhfLegalEntityPicker } from "@/components/ui/rhf-legal-entity-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import {
  adminAddLotToSaleResultAction,
  adminDetachLotFromSaleResultAction,
} from "@/lib/actions/admin-sales";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import {
  findLotsOutsideSaleWindow,
  proposeLotTimesWithinWindow,
  saleInheritsLotTiming,
} from "@/lib/admin/sale-lot-window-sync";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  deliveryModeExplanation,
  emptySaleSetupLotRow,
  fieldTierSuffix,
  humanizeSetupError,
  lotSavedMessage,
  lotsStepFirstLotPrompt,
  mergeSavedLotRow,
  mergeWizardRowsWithServerLots,
  safeParseSaleSetupLotRowForApi,
  scheduleLotConflictBanner,
  scheduleLotConflictInheritedTimingBanner,
  scheduleOutOfSyncBadge,
  syncLotsToSaleWindowLabel,
  updateLotScheduleLabel,
} from "@/lib/admin/sale-setup";
import { applySellerLegalEntitySelection } from "@/lib/admin/seller-legal-entity-form";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { lotAuctionTypes } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import { formatAuctionDatetimeDisplay } from "@auction/validators";
import { saleModeInheritsLotTiming } from "@auction/validators";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";

type Props = {
  saleId: string;
  sale: Pick<Sale, "deliveryMode" | "startTime" | "endTime">;
  lots: Lot[];
  categories: CategoryNode[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  readOnly?: boolean;
  onLotsChange: () => void;
  onUnsavedChange?: (unsaved: boolean) => void;
};

function draftLotRow(source: "new" | "existing"): SaleSetupLotRowFormValues {
  return { ...emptySaleSetupLotRow(crypto.randomUUID()), source };
}

function lotToRow(lot: Lot): SaleSetupLotRowFormValues {
  return {
    clientRowId: lot.id,
    source: "new",
    lotId: lot.id,
    title: lot.title,
    sellerLegalEntityId: lot.sellerLegalEntityId ?? "",
    categoryIds:
      lot.categoryIds && lot.categoryIds.length > 0
        ? lot.categoryIds
        : lot.categoryId
          ? [lot.categoryId]
          : [],
    auctionType: lot.auctionType,
    startingPrice: lot.startingPrice,
    artistId: lot.artistId ?? null,
    startTime: toDatetimeFormString(lot.startTime),
    endTime: toDatetimeFormString(lot.endTime),
  };
}

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

function LotRowEditor({
  row,
  rowIndex,
  ctx,
  categories,
  artists,
  englishOnlyAuctionsLocked,
  readOnly,
  saleId,
  onSaved,
  onRemove,
  onDetached,
  onScheduleUpdated,
}: {
  row: SaleSetupLotRowFormValues;
  rowIndex: number;
  ctx: SaleSetupLotRowContext;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  readOnly: boolean;
  saleId: string;
  onSaved: (lotId: string, values: SaleSetupLotRowFormValues, meta?: { title?: string }) => void;
  onRemove: () => void;
  onDetached?: () => void;
  onScheduleUpdated?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [detachConfirmOpen, setDetachConfirmOpen] = useState(false);
  const form = useForm<SaleSetupLotRowFormValues>({ defaultValues: row });
  const { isDirty } = useFormState({ control: form.control });
  const isSaved = Boolean(row.lotId);
  const isExisting = row.source === "existing";
  const inheritsTiming = saleModeInheritsLotTiming(ctx.deliveryMode);
  const lotStartValue = form.watch("startTime");
  const sellerDisplayName = useWatch({ control: form.control, name: "sellerDisplayName" });
  useEffect(() => {
    form.reset(row);
  }, [form, row]);

  const runDetach = useCallback(() => {
    const lotId = row.lotId;
    if (!lotId) return;
    startTransition(async () => {
      const r = await adminDetachLotFromSaleResultAction(saleId, lotId);
      if (!r.ok) {
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error),
            errorCode: r.errorCode,
          }),
        );
        return;
      }
      notify.success(`Detached ${row.title || "lot"}`);
      setDetachConfirmOpen(false);
      onRemove();
      onDetached?.();
    });
  }, [onDetached, onRemove, row.lotId, row.title, saleId]);

  const auctionTypeOptions = useMemo(() => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    return ["english"] as const;
  }, [englishOnlyAuctionsLocked]);

  const save = useCallback(() => {
    startTransition(async () => {
      const values = form.getValues();
      const parsed = safeParseSaleSetupLotRowForApi(values, ctx);
      if (!parsed.success) {
        applyZodIssuesToForm(form, parsed.error.issues);
        notifyAdminFormValidationFailure({ issues: parsed.error.issues });
        return;
      }
      const r = await adminAddLotToSaleResultAction(saleId, parsed.data);
      if (!r.ok) {
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error, {
              status: r.status,
              errorCode: r.errorCode,
              meta: r.meta,
            }),
            errorCode: r.errorCode,
          }),
        );
        return;
      }
      if (!r.data?.id) return;
      notify.success(lotSavedMessage(values.title));
      onSaved(r.data.id, values);
    });
  }, [ctx, form, onSaved, saleId]);

  const lotScheduleSnapshot = useMemo(() => {
    if (!row.lotId) return null;
    const startRaw = lotStartValue?.trim() || row.startTime?.trim();
    const endRaw = form.watch("endTime")?.trim() || row.endTime?.trim();
    if (!startRaw || !endRaw) return null;
    const startTime = instantFromDatetimeFormString(startRaw);
    const endTime = instantFromDatetimeFormString(endRaw);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) return null;
    return {
      id: row.lotId,
      title: row.title,
      startTime,
      endTime,
    };
  }, [form, lotStartValue, row.endTime, row.lotId, row.startTime, row.title]);

  const scheduleOutOfSync = useMemo(() => {
    if (!lotScheduleSnapshot || inheritsTiming) return false;
    return (
      findLotsOutsideSaleWindow([lotScheduleSnapshot], {
        deliveryMode: ctx.deliveryMode,
        startTime: ctx.saleStartTime,
        endTime: ctx.saleEndTime,
      }).length > 0
    );
  }, [ctx.deliveryMode, ctx.saleEndTime, ctx.saleStartTime, inheritsTiming, lotScheduleSnapshot]);

  const updateSchedule = useCallback(() => {
    if (!row.lotId) return;
    startTransition(async () => {
      const values = form.getValues();
      const parsed = safeParseSaleSetupLotRowForApi(values, ctx);
      if (!parsed.success) {
        applyZodIssuesToForm(form, parsed.error.issues);
        notifyAdminFormValidationFailure({ issues: parsed.error.issues });
        return;
      }
      const r = await adminUpdateLotResultAction(row.lotId as string, {
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      });
      if (!r.ok) {
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error, {
              status: r.status,
              errorCode: r.errorCode,
              meta: r.meta,
            }),
            errorCode: r.errorCode,
          }),
        );
        return;
      }
      notify.success("Lot schedule updated");
      onScheduleUpdated?.();
    });
  }, [ctx, form, onScheduleUpdated, row.lotId]);

  if (isExisting && isSaved) {
    return (
      <>
        <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-headline text-base text-on-surface">
              Lot {rowIndex + 1}
              <span className="ml-2 inline-flex items-center gap-1 font-body text-xs text-primary">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Attached
              </span>
            </p>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDetachConfirmOpen(true)}
                disabled={pending}
                aria-label="Detach lot from sale"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
          <p className="font-body text-sm text-on-surface">{row.title || "Existing lot"}</p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Existing inventory lot attached to this sale.
          </p>
        </div>
        <ConfirmDialog
          open={detachConfirmOpen}
          onOpenChange={setDetachConfirmOpen}
          title="Detach lot from sale?"
          body="Detach this lot from the sale? It returns to inventory as a standalone draft lot."
          confirmLabel="Detach"
          tone="warning"
          loading={pending}
          onConfirm={runDetach}
        />
      </>
    );
  }

  if (isExisting && !isSaved && !readOnly) {
    return (
      <AttachExistingLotReview
        saleId={saleId}
        saleWindow={{
          deliveryMode: ctx.deliveryMode,
          startTime: ctx.saleStartTime,
          endTime: ctx.saleEndTime,
        }}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        attachVia="wizard"
        categories={categories}
        artists={artists}
        onAttached={(lotId, title) => {
          onSaved(lotId, { ...row, title }, { title });
        }}
        headerSlot={
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-headline text-base text-on-surface">
              Attach existing lot {rowIndex + 1}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove row"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        }
      />
    );
  }

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
                  onChange={(id, row) =>
                    applySellerLegalEntitySelection(
                      field.onChange,
                      (name) =>
                        form.setValue("sellerDisplayName", name, {
                          shouldDirty: true,
                          shouldValidate: false,
                        }),
                      id,
                      row,
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
                Sale runs {formatAuctionDatetimeDisplay(ctx.saleStartTime)} –{" "}
                {formatAuctionDatetimeDisplay(ctx.saleEndTime)} (London time). Lot times must fall
                within this window.
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
                onClick={save}
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
                onClick={updateSchedule}
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

export function SaleLotRowsEditor({
  saleId,
  sale,
  lots,
  categories,
  artists,
  englishOnlyAuctionsLocked,
  readOnly = false,
  onLotsChange,
  onUnsavedChange,
}: Props) {
  const [rows, setRows] = useState<SaleSetupLotRowFormValues[]>(() => {
    if (lots.length > 0) return lots.map(lotToRow);
    return [];
  });

  const showFirstLotChoice = !readOnly && lots.length === 0 && rows.length === 0;
  const showAddLotActions = !readOnly && !showFirstLotChoice;

  const unsavedCount = rows.filter((r) => !r.lotId).length;

  useEffect(() => {
    onUnsavedChange?.(unsavedCount > 0);
  }, [onUnsavedChange, unsavedCount]);

  useEffect(() => {
    setRows((prev) => mergeWizardRowsWithServerLots(prev, lots, lotToRow));
  }, [lots]);

  const ctx: SaleSetupLotRowContext = useMemo(
    () => ({
      saleStartTime: sale.startTime,
      saleEndTime: sale.endTime,
      deliveryMode: sale.deliveryMode,
      englishOnlyAuctionsLocked,
    }),
    [englishOnlyAuctionsLocked, sale.deliveryMode, sale.endTime, sale.startTime],
  );

  const lotWindowConflicts = useMemo(
    () =>
      findLotsOutsideSaleWindow(lots, {
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      }),
    [lots, sale.deliveryMode, sale.endTime, sale.startTime],
  );

  const [syncPending, startSyncTransition] = useTransition();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const syncConfirmBody =
    lotWindowConflicts.length === 1
      ? "Adjust this lot's open/close times to fit the sale window?"
      : `Adjust ${lotWindowConflicts.length} lots' open/close times to fit the sale window?`;

  const runSyncLotsToWindow = useCallback(() => {
    if (lotWindowConflicts.length === 0) return;
    startSyncTransition(async () => {
      const window = {
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      };
      for (const conflict of lotWindowConflicts) {
        const proposed = proposeLotTimesWithinWindow(conflict.lot, window);
        const r = await adminUpdateLotResultAction(conflict.lot.id, proposed);
        if (!r.ok) {
          notify.error(
            humanizeSetupError({
              message: actionFailureNotifyMessage(r.error, {
                status: r.status,
                errorCode: r.errorCode,
                meta: r.meta,
              }),
              errorCode: r.errorCode,
            }),
          );
          return;
        }
      }
      notify.success("Lot schedules updated");
      setSyncConfirmOpen(false);
      onLotsChange();
    });
  }, [lotWindowConflicts, onLotsChange, sale.deliveryMode, sale.endTime, sale.startTime]);

  const inheritsLotTiming = saleInheritsLotTiming(sale);

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>{deliveryModeExplanation(sale.deliveryMode)}</AlertDescription>
      </Alert>

      {lotWindowConflicts.length > 0 && !readOnly ? (
        <Alert
          className={
            inheritsLotTiming
              ? "border-outline-variant/40 bg-surface-container-low/40"
              : "border-warning/40 bg-warning/5"
          }
        >
          <AlertDescription className="space-y-3 font-body text-sm text-on-surface-variant">
            <p>
              {inheritsLotTiming
                ? scheduleLotConflictInheritedTimingBanner(lotWindowConflicts.length)
                : scheduleLotConflictBanner(lotWindowConflicts.length)}
            </p>
            {!inheritsLotTiming ? (
              <LoadingButton
                type="button"
                size="sm"
                variant="secondary"
                loading={syncPending}
                onClick={() => setSyncConfirmOpen(true)}
              >
                {syncLotsToSaleWindowLabel(lotWindowConflicts.length)}
              </LoadingButton>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {showFirstLotChoice ? (
        <div className="rounded-xl border border-dashed border-border-hairline bg-surface-container-low/40 p-6">
          <p className="font-headline text-base text-on-surface">{lotsStepFirstLotPrompt()}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setRows((prev) => [...prev, draftLotRow("new")])}
              className="gap-2"
            >
              <Plus className="size-4" aria-hidden />
              Create new lot
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((prev) => [...prev, draftLotRow("existing")])}
              className="gap-2"
            >
              <Plus className="size-4" aria-hidden />
              Add existing lot
            </Button>
          </div>
        </div>
      ) : null}

      {readOnly && lots.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No lots yet.</p>
      ) : null}

      {rows.map((row, index) => (
        <LotRowEditor
          key={row.clientRowId}
          row={row}
          rowIndex={index}
          ctx={ctx}
          categories={categories}
          artists={artists}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          readOnly={readOnly}
          saleId={saleId}
          onSaved={(lotId, values, meta) => {
            setRows((prev) =>
              prev.map((r) =>
                r.clientRowId === row.clientRowId ? mergeSavedLotRow(values, lotId, meta) : r,
              ),
            );
            onLotsChange();
          }}
          onRemove={() => setRows((prev) => prev.filter((r) => r.clientRowId !== row.clientRowId))}
          onDetached={onLotsChange}
          onScheduleUpdated={onLotsChange}
        />
      ))}

      {showAddLotActions ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((prev) => [...prev, draftLotRow("new")])}
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden />
            Create new lot
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((prev) => [...prev, draftLotRow("existing")])}
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden />
            Add existing lot
          </Button>
        </div>
      ) : null}

      {unsavedCount > 0 ? (
        <Alert variant="destructive">
          <AlertDescription role="alert">
            Save {unsavedCount} unsaved lot{unsavedCount === 1 ? "" : "s"} before continuing.
          </AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={syncConfirmOpen}
        onOpenChange={setSyncConfirmOpen}
        title={syncLotsToSaleWindowLabel(lotWindowConflicts.length)}
        body={syncConfirmBody}
        confirmLabel="Adjust times"
        tone="warning"
        loading={syncPending}
        onConfirm={runSyncLotsToWindow}
      />
    </div>
  );
}

export function saleLotRowsHaveUnsaved(rows: SaleSetupLotRowFormValues[]): boolean {
  return rows.some((r) => !r.lotId);
}

export function saleLotRowsCountSaved(rows: SaleSetupLotRowFormValues[]): number {
  return rows.filter((r) => r.lotId).length;
}
