"use client";

import {
  clearWizardDraft,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  adminCreateSaleResultAction,
  adminPublishSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { applyCatalogZodIssueToForm } from "@/lib/admin/catalog-form-zod";
import {
  findLotsOutsideSaleWindow,
  parseSaleWindowFromForm,
} from "@/lib/admin/sale-lot-window-sync";
import {
  humanizeSetupError,
  saleSavedMessage,
  saveDraftSuccessMessage,
  scheduleLotConflictPersistBlocked,
} from "@/lib/admin/sale-setup";
import type { SaleSetupStepId } from "@/lib/admin/sale-setup";
import {
  type AdminSaleFormValues,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { Lot } from "@auction/types";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { useCallback, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { saleSetupZodIssuePath } from "./use-sale-setup-steps";

type PersistOpts = { savedNoticeStep?: SaleSetupStepId };

type UseSaleSetupSubmitArgs = {
  form: UseFormReturn<AdminSaleFormValues>;
  saleId: string | null;
  setSaleId: (id: string | null) => void;
  lots: Lot[];
  wizardDraftEntityId?: string | undefined;
  wizardGoToRef: RefObject<(index: number) => void>;
  setStepNotice: (msg: string | null) => void;
  setShowFirstSaveNudge: (show: boolean) => void;
};

export function useSaleSetupSubmit({
  form,
  saleId,
  setSaleId,
  lots,
  wizardDraftEntityId,
  wizardGoToRef,
  setStepNotice,
  setShowFirstSaveNudge,
}: UseSaleSetupSubmitArgs) {
  const router = useRouter();
  const createIdempotencyKeyRef = useRef(`sale-create-${crypto.randomUUID()}`);

  const persistSale = useCallback(
    async (opts?: PersistOpts): Promise<string | null> => {
      const values = form.getValues();
      if (!saleId) {
        const api = safeParseCreateSaleFromForm(values);
        if (!api.success) {
          for (const iss of api.error.issues) {
            applyCatalogZodIssueToForm(form, [...iss.path], iss.message, saleSetupZodIssuePath);
          }
          notifyAdminFormValidationFailure({ issues: api.error.issues });
          return null;
        }
        const r = await adminCreateSaleResultAction(api.data, createIdempotencyKeyRef.current);
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
          return null;
        }
        clearWizardDraft(wizardDraftCookieKey("admin_sale_new", wizardDraftEntityId ?? "new"));
        if (!r.data?.id) return null;
        const newId = r.data.id;
        setSaleId(newId);
        setShowFirstSaveNudge(true);
        router.replace(`/admin/sales/${newId}/setup?step=schedule`);
        setStepNotice(saleSavedMessage("schedule"));
        return newId;
      }

      const api = safeParseUpdateSaleFromForm(values);
      if (!api.success) {
        for (const iss of api.error.issues) {
          applyCatalogZodIssueToForm(form, [...iss.path], iss.message, saleSetupZodIssuePath);
        }
        notifyAdminFormValidationFailure({ issues: api.error.issues });
        return null;
      }
      const pendingWindow = parseSaleWindowFromForm(values);
      if (pendingWindow && lots.length > 0) {
        const conflicts = findLotsOutsideSaleWindow(lots, pendingWindow);
        if (conflicts.length > 0) {
          const titles = conflicts.map((c) => c.lot.title.trim() || "Untitled lot");
          setStepNotice(scheduleLotConflictPersistBlocked(titles));
          wizardGoToRef.current(1);
          return null;
        }
      }
      const r = await adminUpdateSaleResultAction(saleId, api.data);
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
        return null;
      }
      setStepNotice(saleSavedMessage(opts?.savedNoticeStep ?? "lots"));
      router.refresh();
      return saleId;
    },
    [
      form,
      lots,
      router,
      saleId,
      setSaleId,
      setShowFirstSaveNudge,
      setStepNotice,
      wizardDraftEntityId,
      wizardGoToRef,
    ],
  );

  const handlePublish = useCallback(
    async (currentSaleId: string) => {
      if (form.formState.isDirty) {
        const id = await persistSale({ savedNoticeStep: "review" });
        if (!id) return false;
      }
      const r = await adminPublishSaleResultAction(currentSaleId);
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
        return false;
      }
      notify.success("Sale published");
      router.push(`/admin/sales/${currentSaleId}`);
      return true;
    },
    [form.formState.isDirty, persistSale, router],
  );

  return { persistSale, handlePublish, saveDraftSuccessMessage };
}

export type UseSaleSetupSubmitReturn = ReturnType<typeof useSaleSetupSubmit>;
