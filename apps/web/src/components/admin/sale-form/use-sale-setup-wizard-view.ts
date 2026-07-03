"use client";

import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import { parseSaleWindowFromForm, parseSaleWindowFromSale } from "@/lib/admin/sale-lot-window-sync";
import {
  buildSaleSetupReadiness,
  saleSetupHref,
  saleSetupStepId,
  saveDraftSuccessMessage,
} from "@/lib/admin/sale-setup";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import { notify } from "@/lib/ui/notify";
import type { Lot, Sale } from "@auction/types";
import {
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isSaleroomDeliveryMode,
  isUkPostcode,
} from "@auction/validators";
import { useCallback, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { isSaleSetupReadyToPublish } from "./steps/review-step";

type PersistSaleFn = (input: {
  savedNoticeStep: ReturnType<typeof saleSetupStepId>;
  nextStep?: ReturnType<typeof saleSetupStepId>;
}) => Promise<string | null>;

type UseSaleSetupWizardViewInput = {
  form: UseFormReturn<AdminSaleFormValues>;
  sale: Sale | null;
  saleId: string | null;
  lots: Lot[];
  lotsUnsaved: boolean;
  wizardStepIndex: number;
  showFirstSaveNudge: boolean;
  pendingRegistrationCount: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId | undefined;
  canManageSale: boolean;
  pending: boolean;
  guardedPush: (href: string) => void;
  persistSale: PersistSaleFn;
  startTransition: (callback: () => void) => void;
  onPublishOpen: () => void;
};

export function useSaleSetupWizardView({
  form,
  sale,
  saleId,
  lots,
  lotsUnsaved,
  wizardStepIndex,
  showFirstSaveNudge,
  pendingRegistrationCount,
  connectRequiredByLotId,
  canManageSale,
  pending,
  guardedPush,
  persistSale,
  startTransition,
  onPublishOpen,
}: UseSaleSetupWizardViewInput) {
  const deliveryMode = form.watch("deliveryMode");
  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");
  const isSaleroom = isSaleroomDeliveryMode(
    (deliveryMode ?? "online") as "online" | "onsite" | "hybrid",
  );
  const watchedLocation = {
    locationName: form.watch("locationName"),
    locationAddressLine1: form.watch("locationAddressLine1"),
    locationAddressLine2: form.watch("locationAddressLine2"),
    locationCity: form.watch("locationCity"),
    locationCounty: form.watch("locationCounty"),
    locationPostcode: form.watch("locationPostcode"),
    locationCountry: form.watch("locationCountry"),
    locationAddress: form.watch("locationAddress"),
  };
  const formattedPreviewAddress = formatPostalAddress(watchedLocation);
  const previewMapUrl = buildGoogleMapsSearchUrl(watchedLocation);
  const customMapUrl = form.watch("locationMapUrl");
  const postcodeRaw = watchedLocation.locationPostcode ?? "";
  const postcodeIsValid = postcodeRaw.trim() === "" || isUkPostcode(postcodeRaw);

  const activeSale = sale;
  const pendingSaleWindow = useMemo(() => {
    const fromForm = parseSaleWindowFromForm({
      deliveryMode,
      startTime: watchedStartTime,
      endTime: watchedEndTime,
    });
    if (fromForm) return fromForm;
    return activeSale ? parseSaleWindowFromSale(activeSale) : null;
  }, [activeSale, deliveryMode, watchedEndTime, watchedStartTime]);

  const readyToPublish =
    saleId &&
    activeSale &&
    !form.formState.isDirty &&
    !lotsUnsaved &&
    isSaleSetupReadyToPublish(
      saleId,
      activeSale,
      lots,
      pendingRegistrationCount,
      connectRequiredByLotId,
    );

  const isReviewStep = saleSetupStepId(wizardStepIndex) === "review";
  const setupReadinessNudge =
    showFirstSaveNudge && saleId && activeSale && wizardStepIndex >= 1
      ? buildSaleSetupReadiness({
          saleId,
          sale: activeSale,
          lots,
          pendingRegistrationCount,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
          setupStepHref: (step) => saleSetupHref(saleId, step),
        })
      : null;

  const handleSaveDraft = useCallback(() => {
    startTransition(async () => {
      if (saleId && canManageSale && form.formState.isDirty) {
        const id = await persistSale({
          savedNoticeStep: isReviewStep ? "review" : saleSetupStepId(wizardStepIndex),
        });
        if (!id) return;
      }
      notify.success(saveDraftSuccessMessage());
      guardedPush(saleId ? `/admin/sales/${saleId}?created=1` : "/admin/sales");
    });
  }, [
    canManageSale,
    form.formState.isDirty,
    guardedPush,
    isReviewStep,
    persistSale,
    saleId,
    startTransition,
    wizardStepIndex,
  ]);

  const mobilePrimaryAction = useMemo(() => {
    if (!isReviewStep) return null;
    if (!canManageSale) {
      return {
        label: "Back to sale",
        onClick: () => guardedPush(saleId ? `/admin/sales/${saleId}` : "/admin/sales"),
      };
    }
    return {
      label: "Publish sale",
      onClick: onPublishOpen,
      ...(!readyToPublish || pending ? { disabled: true as const } : {}),
    };
  }, [canManageSale, guardedPush, isReviewStep, onPublishOpen, pending, readyToPublish, saleId]);

  const mobileCancelAction = useMemo(() => {
    if (saleId) {
      return {
        label: isReviewStep ? "Save as draft" : WIZARD_COPY.finishLater,
        onClick: handleSaveDraft,
      };
    }
    return { label: "Cancel", href: "/admin/sales" };
  }, [handleSaveDraft, isReviewStep, saleId]);

  return {
    isSaleroom,
    formattedPreviewAddress,
    previewMapUrl,
    customMapUrl,
    postcodeIsValid,
    pendingSaleWindow,
    readyToPublish,
    isReviewStep,
    setupReadinessNudge,
    handleSaveDraft,
    mobilePrimaryAction,
    mobileCancelAction,
  };
}
