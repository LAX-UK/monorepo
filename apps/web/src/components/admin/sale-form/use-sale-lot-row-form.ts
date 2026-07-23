"use client";

import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { adminAddLotToSaleResultAction } from "@/lib/actions/admin-sales";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { adminDetachLotFromSaleResultAction } from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { findLotsOutsideSaleWindow } from "@/lib/admin/sale-lot-window-sync";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  lotSavedMessage,
  safeParseSaleSetupLotRowForApi,
} from "@/lib/admin/sale-setup";
import { notifySaleSetupActionFailure } from "@/lib/admin/sale-setup/notify-sale-setup-action-failure.client";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import { lotAuctionTypes } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import { saleModeInheritsLotTiming } from "@auction/validators";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";

type UseSaleLotRowFormInput = {
  row: SaleSetupLotRowFormValues;
  ctx: SaleSetupLotRowContext;
  englishOnlyAuctionsLocked: boolean;
  saleId: string;
  onSaved: (lotId: string, values: SaleSetupLotRowFormValues, meta?: { title?: string }) => void;
  onRemove: () => void;
  onDetached?: (() => void) | undefined;
  onScheduleUpdated?: (() => void) | undefined;
};

export function useSaleLotRowForm({
  row,
  ctx,
  englishOnlyAuctionsLocked,
  saleId,
  onSaved,
  onRemove,
  onDetached,
  onScheduleUpdated,
}: UseSaleLotRowFormInput) {
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
        notifySaleSetupActionFailure(r);
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
        notifySaleSetupActionFailure(r);
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
        notifySaleSetupActionFailure(r);
        return;
      }
      notify.success("Lot schedule updated");
      onScheduleUpdated?.();
    });
  }, [ctx, form, onScheduleUpdated, row.lotId]);

  return {
    pending,
    detachConfirmOpen,
    setDetachConfirmOpen,
    form,
    isDirty,
    isSaved,
    isExisting,
    inheritsTiming,
    sellerDisplayName,
    runDetach,
    auctionTypeOptions,
    save,
    scheduleOutOfSync,
    updateSchedule,
  };
}
