"use client";

import { AdminLotPicker } from "@/components/admin/admin-lot-picker";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { LabelCaps } from "@/components/ui/typography";
import { adminGetLotAttachPreviewAction, adminUpdateLotResultAction } from "@/lib/actions/admin";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import {
  attachReviewScheduleChanged,
  attachReviewScheduleViolation,
  inventoryLotToAttachReviewRow,
  validateAttachReviewSchedule,
} from "@/lib/admin/attach-existing-lot";
import { adminAttachLotToSaleResultAction } from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { proposeLotTimesWithinWindow } from "@/lib/admin/sale-lot-window-sync";
import {
  type SaleSetupLotRowFormValues,
  attachLotChangeLotLabel,
  attachLotReviewPrompt,
  attachLotScheduleConflictBanner,
  emptySaleSetupLotRow,
  fieldTierSuffix,
  syncLotsToSaleWindowLabel,
} from "@/lib/admin/sale-setup";
import { notifySaleSetupActionFailure } from "@/lib/admin/sale-setup/notify-sale-setup-action-failure.client";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";
import { formatAuctionDatetimeDisplay, saleModeInheritsLotTiming } from "@auction/validators";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

type SaleWindow = Pick<Sale, "deliveryMode" | "startTime" | "endTime">;

type Props = {
  saleId: string;
  saleWindow: SaleWindow;
  englishOnlyAuctionsLocked?: boolean;
  attachVia?: "attach_endpoint" | "wizard";
  onAttached: (lotId: string, title: string) => void;
  onCancelSelection?: () => void;
  headerSlot?: React.ReactNode;
  categories?: CategoryNode[];
  artists?: ArtistProfile[];
  disabled?: boolean;
  className?: string;
};

function resolveCategoryLabels(categoryIds: string[], categories?: CategoryNode[]): string {
  if (categoryIds.length === 0) return "None";
  if (!categories?.length) {
    return `${categoryIds.length} categor${categoryIds.length === 1 ? "y" : "ies"}`;
  }
  const byId = new Map<string, string>();
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      byId.set(node.id, node.name);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(categories);
  const names = categoryIds.map((id) => byId.get(id) ?? id.slice(0, 8));
  return names.join(", ");
}

function artistLabel(
  artistId: string | null | undefined,
  artists?: ArtistProfile[],
): string | null {
  if (!artistId) return null;
  const artist = artists?.find((a) => a.id === artistId);
  return artist?.displayName ?? null;
}

export function AttachExistingLotReview({
  saleId,
  saleWindow,
  englishOnlyAuctionsLocked = false,
  attachVia = "attach_endpoint",
  onAttached,
  onCancelSelection,
  headerSlot,
  categories,
  artists,
  disabled = false,
  className,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [pickerLotId, setPickerLotId] = useState<string | null>(null);
  const [pickerTitle, setPickerTitle] = useState<string | null>(null);
  const [previewLot, setPreviewLot] = useState<Lot | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const ctx = useMemo(
    () => ({
      saleStartTime: saleWindow.startTime,
      saleEndTime: saleWindow.endTime,
      deliveryMode: saleWindow.deliveryMode,
      englishOnlyAuctionsLocked,
    }),
    [englishOnlyAuctionsLocked, saleWindow.deliveryMode, saleWindow.endTime, saleWindow.startTime],
  );

  const inheritsTiming = saleModeInheritsLotTiming(saleWindow.deliveryMode);

  const form = useForm<SaleSetupLotRowFormValues>({
    defaultValues: emptySaleSetupLotRow("attach-review"),
  });

  const lotStartValue = form.watch("startTime");
  const lotEndValue = form.watch("endTime");

  const loadPreview = useCallback(
    async (lotId: string) => {
      setLoadingPreview(true);
      setPreviewError(null);
      setPreviewLot(null);
      const r = await adminGetLotAttachPreviewAction(lotId);
      setLoadingPreview(false);
      if (!r.ok || !r.data) {
        setPreviewError(r.ok ? "Lot not found" : r.error);
        setPickerLotId(null);
        setPickerTitle(null);
        return;
      }
      setPreviewLot(r.data);
      form.reset(inventoryLotToAttachReviewRow(r.data, "attach-review"));
    },
    [form],
  );

  useEffect(() => {
    if (!pickerLotId) {
      setPreviewLot(null);
      setPreviewError(null);
      return;
    }
    void loadPreview(pickerLotId);
  }, [loadPreview, pickerLotId]);

  const scheduleViolation = useMemo(() => {
    if (inheritsTiming || !previewLot) return null;
    return attachReviewScheduleViolation({ startTime: lotStartValue, endTime: lotEndValue }, ctx);
  }, [ctx, inheritsTiming, lotEndValue, lotStartValue, previewLot]);

  const clearSelection = useCallback(() => {
    setPickerLotId(null);
    setPickerTitle(null);
    setPreviewLot(null);
    setPreviewError(null);
    onCancelSelection?.();
  }, [onCancelSelection]);

  const syncScheduleToWindow = useCallback(() => {
    if (!previewLot || inheritsTiming) return;
    const proposed = proposeLotTimesWithinWindow(previewLot, {
      deliveryMode: saleWindow.deliveryMode,
      startTime: saleWindow.startTime,
      endTime: saleWindow.endTime,
    });
    form.setValue("startTime", toDatetimeFormString(proposed.startTime), { shouldValidate: true });
    form.setValue("endTime", toDatetimeFormString(proposed.endTime), { shouldValidate: true });
  }, [
    form,
    inheritsTiming,
    previewLot,
    saleWindow.deliveryMode,
    saleWindow.endTime,
    saleWindow.startTime,
  ]);

  const attach = useCallback(() => {
    if (!previewLot || !pickerLotId) return;
    startTransition(async () => {
      const values = form.getValues();
      const validated = validateAttachReviewSchedule(values, ctx);
      if (!validated.ok) {
        const issues = Object.entries(validated.fieldErrors).flatMap(([path, message]) =>
          message ? [{ path: [path], message }] : [],
        );
        applyZodIssuesToForm(form, issues);
        notifyAdminFormValidationFailure({ issues });
        return;
      }

      if (attachReviewScheduleChanged(previewLot, values)) {
        const r = await adminUpdateLotResultAction(pickerLotId, {
          startTime: validated.payload.startTime,
          endTime: validated.payload.endTime,
        });
        if (!r.ok) {
          notifySaleSetupActionFailure(r);
          return;
        }
      }

      const attachResult = await adminAttachLotToSaleResultAction(saleId, pickerLotId, {
        via: attachVia,
      });
      if (!attachResult.ok) {
        notifySaleSetupActionFailure(attachResult);
        return;
      }

      notify.success(`Attached ${values.title.trim() || pickerTitle || "lot"}`);
      onAttached(pickerLotId, values.title.trim() || pickerTitle || "lot");
      clearSelection();
    });
  }, [
    attachVia,
    clearSelection,
    ctx,
    form,
    onAttached,
    pickerLotId,
    pickerTitle,
    previewLot,
    saleId,
  ]);

  const values = form.watch();
  const canAttach =
    Boolean(previewLot) &&
    !loadingPreview &&
    !scheduleViolation &&
    validateAttachReviewSchedule(values, ctx).ok;

  return (
    <div className={className ?? "space-y-4"}>
      {headerSlot}

      {!previewLot && !loadingPreview ? (
        <AdminLotPicker
          value={pickerLotId}
          displayLabel={pickerTitle}
          excludeSaleId={saleId}
          disabled={disabled || pending}
          onChange={(id, hit) => {
            setPickerLotId(id);
            setPickerTitle(hit?.title ?? null);
          }}
        />
      ) : null}

      {loadingPreview ? (
        <p className="font-body text-sm text-on-surface-variant">Loading lot details…</p>
      ) : null}

      {previewError ? (
        <p className="font-body text-sm text-error" role="alert">
          {previewError}
        </p>
      ) : null}

      {previewLot ? (
        <Form {...form}>
          <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-headline text-base text-on-surface">{attachLotReviewPrompt()}</p>
                <p className="mt-1 font-body text-sm text-on-surface-variant">
                  <Link
                    href={`/admin/lots/${previewLot.id}/edit`}
                    className="text-link hover:underline"
                  >
                    Edit full lot details
                  </Link>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || pending}
                onClick={clearSelection}
              >
                {attachLotChangeLotLabel()}
              </Button>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                  Title
                </dt>
                <dd className="font-body text-sm text-on-surface">{previewLot.title}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                  Auction type
                </dt>
                <dd className="font-body text-sm text-on-surface">
                  <LotAuctionTypeChip auctionType={previewLot.auctionType} />
                </dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                  Starting price
                </dt>
                <dd className="font-body text-sm text-on-surface">{previewLot.startingPrice}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                  Categories
                </dt>
                <dd className="font-body text-sm text-on-surface">
                  {resolveCategoryLabels(values.categoryIds, categories)}
                </dd>
              </div>
              {artistLabel(previewLot.artistId, artists) ? (
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                    Artist
                  </dt>
                  <dd className="font-body text-sm text-on-surface">
                    {artistLabel(previewLot.artistId, artists)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {inheritsTiming ? (
              <p className="font-body text-xs text-on-surface-variant">
                Lot times match the sale schedule automatically for onsite sales (
                {formatAuctionDatetimeDisplay(saleWindow.startTime)} –{" "}
                {formatAuctionDatetimeDisplay(saleWindow.endTime)}).
              </p>
            ) : (
              <div className="space-y-4">
                {scheduleViolation ? (
                  <Alert className="border-warning/40 bg-warning/5">
                    <AlertDescription className="space-y-3 font-body text-sm text-on-surface-variant">
                      <p>{attachLotScheduleConflictBanner()}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={syncScheduleToWindow}
                      >
                        {syncLotsToSaleWindowLabel(1)}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

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
                          disabled={disabled || pending}
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
                          disabled={disabled || pending}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="font-body text-xs text-on-surface-variant">
                  Sale runs {formatAuctionDatetimeDisplay(saleWindow.startTime)} –{" "}
                  {formatAuctionDatetimeDisplay(saleWindow.endTime)} (London time). Lot times must fall within
                  this window.
                </p>
              </div>
            )}

            <LoadingButton
              type="button"
              loading={pending}
              disabled={disabled || !canAttach}
              onClick={attach}
              className="w-full sm:w-auto"
            >
              Attach to sale
            </LoadingButton>
          </div>
        </Form>
      ) : null}
    </div>
  );
}
