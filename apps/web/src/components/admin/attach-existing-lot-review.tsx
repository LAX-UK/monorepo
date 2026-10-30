"use client";

import { AdminLotPicker } from "@/components/admin/admin-lot-picker";
import {
  LotWindowFields,
  isoToFormString,
} from "@/components/admin/sale-lots-tab/lot-window-fields";
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
  syncLotsToSaleWindowLabel,
} from "@/lib/admin/sale-setup";
import { notifySaleSetupActionFailure } from "@/lib/admin/sale-setup/notify-sale-setup-action-failure.client";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import { resolveLotAuctionTypePresentation } from "@/lib/presenters/lot-auction-type-presentation";
import { notify } from "@/lib/ui/notify";
import {
  KeyValueList,
  Notice,
  StaffButton,
  type StaffLinkComponent,
  TextLink,
} from "@auction/staff-ui";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import { formatAuctionDatetimeDisplay, saleModeInheritsLotTiming } from "@auction/validators";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

const NextLink: StaffLinkComponent = Link;

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

  const startError = form.formState.errors.startTime?.message;
  const endError = form.formState.errors.endTime?.message;
  const toIso = (value: string | undefined) => {
    if (!value?.trim()) return null;
    const instant = instantFromDatetimeFormString(value);
    return instant ? instant.toISOString() : null;
  };
  const category = resolveCategoryLabels(values.categoryIds, categories);
  const artist = previewLot ? artistLabel(previewLot.artistId, artists) : null;
  const windowText = `${formatAuctionDatetimeDisplay(saleWindow.startTime)} – ${formatAuctionDatetimeDisplay(saleWindow.endTime)}`;

  return (
    <div className={className ?? "flex flex-col gap-4"}>
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
        <output className="block text-staff-sm text-staff-muted">Loading lot details…</output>
      ) : null}

      {previewError ? (
        <Notice tone="danger" alert title="Could not load that lot">
          {previewError}
        </Notice>
      ) : null}

      {previewLot ? (
        <div className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-staff-md font-semibold text-staff-fg">{attachLotReviewPrompt()}</p>
              <p className="mt-1 text-staff-sm">
                <TextLink Link={NextLink} href={`/admin/lots/${previewLot.id}/edit`}>
                  Edit full lot details
                </TextLink>
              </p>
            </div>
            <StaffButton
              size="sm"
              variant="ghost"
              disabled={disabled || pending}
              onClick={clearSelection}
            >
              {attachLotChangeLotLabel()}
            </StaffButton>
          </div>

          <KeyValueList
            columns={2}
            items={[
              { label: "Title", value: previewLot.title },
              {
                label: "Auction type",
                value: resolveLotAuctionTypePresentation(previewLot.auctionType).label,
              },
              { label: "Starting price", value: previewLot.startingPrice, numeric: true },
              { label: "Categories", value: category },
              ...(artist ? [{ label: "Artist", value: artist }] : []),
            ]}
          />

          {inheritsTiming ? (
            <p className="text-staff-sm text-staff-muted">
              Lot times match the sale schedule automatically for onsite sales ({windowText}).
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {scheduleViolation ? (
                <Notice
                  tone="warning"
                  title="This lot's times fall outside the sale"
                  actions={
                    <StaffButton size="sm" variant="secondary" onClick={syncScheduleToWindow}>
                      {syncLotsToSaleWindowLabel(1)}
                    </StaffButton>
                  }
                >
                  {attachLotScheduleConflictBanner()}
                </Notice>
              ) : null}
              <LotWindowFields
                start={toIso(lotStartValue)}
                end={toIso(lotEndValue)}
                onStartChange={(iso) =>
                  form.setValue("startTime", isoToFormString(iso), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                onEndChange={(iso) =>
                  form.setValue("endTime", isoToFormString(iso), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                startError={startError}
                endError={endError}
                disabled={disabled || pending}
                idPrefix="attach-review"
              />
              <p className="text-staff-xs text-staff-muted">
                Sale runs {windowText} (London time). Lot times must fall within this window.
              </p>
            </div>
          )}

          <div>
            <StaffButton
              variant="primary"
              loading={pending}
              disabled={disabled || !canAttach}
              onClick={attach}
            >
              Attach to sale
            </StaffButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
