"use client";

import {
  LotWindowFields,
  isoToFormString,
} from "@/components/admin/sale-lots-tab/lot-window-fields";
import { adminGetLotAttachPreviewAction, adminUpdateLotResultAction } from "@/lib/actions/admin";
import { searchAdminLotsBrowseAction } from "@/lib/actions/admin-lots-browse";
import {
  attachReviewScheduleChanged,
  attachReviewScheduleViolation,
  inventoryLotToAttachReviewRow,
  validateAttachReviewSchedule,
} from "@/lib/admin/attach-existing-lot";
import { adminAttachLotToSaleResultAction } from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { proposeLotTimesWithinWindow } from "@/lib/admin/sale-lot-window-sync";
import {
  attachExistingLotPanelBody,
  attachLotChangeLotLabel,
  attachLotScheduleConflictBanner,
  syncLotsToSaleWindowLabel,
} from "@/lib/admin/sale-setup";
import { formatSaleSetupActionError } from "@/lib/admin/sale-setup/format-sale-setup-action-error";
import { resolveLotAuctionTypePresentation } from "@/lib/presenters/lot-auction-type-presentation";
import { notify } from "@/lib/ui/notify";
import {
  type EntityOption,
  EntityPicker,
  Field,
  KeyValueList,
  Notice,
  StaffButton,
  StaffDialog,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { CategoryNode, Lot, Sale } from "@auction/types";
import { saleModeInheritsLotTiming } from "@auction/validators";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const FORM_ID = "attach-existing-lot";

type SaleWindow = Pick<Sale, "deliveryMode" | "startTime" | "endTime">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleWindow: SaleWindow;
  englishOnlyAuctionsLocked?: boolean;
  /** Names the lot's categories; without it the dialog says how many there are. */
  categories?: CategoryNode[];
  /** After the lot is attached; the page refreshes unless this navigates. */
  onAttached: (lotId: string, title: string) => void;
};

function categoryLabel(categoryIds: readonly string[], categories?: CategoryNode[]): string {
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
  return categoryIds.map((id) => byId.get(id) ?? "Unnamed category").join(", ");
}

function moneyMinor(major: string): number | null {
  const value = Number.parseFloat(major);
  return Number.isNaN(value) ? null : Math.round(value * 100);
}

/**
 * Attaches an existing inventory lot to a draft sale: choose the lot by name, review it, fit its
 * opening and closing times to the sale window when the sale runs lot by lot, then attach. A
 * failure stays in the dialog with what was chosen. Times are checked on submit and again on every
 * change after that.
 */
export function AttachExistingLotDialog({
  open,
  onOpenChange,
  saleId,
  saleWindow,
  englishOnlyAuctionsLocked = false,
  categories,
  onAttached,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [picked, setPicked] = useState<EntityOption | null>(null);
  const [preview, setPreview] = useState<Lot | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const inheritsTiming = saleModeInheritsLotTiming(saleWindow.deliveryMode);
  const ctx = useMemo(
    () => ({
      saleStartTime: saleWindow.startTime,
      saleEndTime: saleWindow.endTime,
      deliveryMode: saleWindow.deliveryMode,
      englishOnlyAuctionsLocked,
    }),
    [englishOnlyAuctionsLocked, saleWindow.deliveryMode, saleWindow.endTime, saleWindow.startTime],
  );

  useEffect(() => {
    if (open) return;
    setPicked(null);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
    setStart(null);
    setEnd(null);
    setSubmitted(false);
    setFailure(null);
  }, [open]);

  const choose = useCallback(async (option: EntityOption | null) => {
    setPicked(option);
    setPreview(null);
    setPreviewError(null);
    setFailure(null);
    setSubmitted(false);
    if (!option) return;
    setLoadingPreview(true);
    const result = await adminGetLotAttachPreviewAction(option.id);
    setLoadingPreview(false);
    if (!result.ok || !result.data) {
      setPicked(null);
      setPreviewError(result.ok ? "That lot could not be found." : result.error);
      return;
    }
    setPreview(result.data);
    setStart(result.data.startTime.toISOString());
    setEnd(result.data.endTime.toISOString());
  }, []);

  const searchLots = useCallback(
    async (query: string): Promise<EntityOption[]> => {
      const result = await searchAdminLotsBrowseAction({
        ...(query ? { q: query } : {}),
        state: "all",
        excludeSaleId: saleId,
        limit: 25,
        offset: 0,
      });
      if (!result.ok) throw new Error(result.error || "Search failed");
      return (result.data?.rows ?? []).map((row) => ({
        id: row.id,
        label: row.title,
        description:
          row.lifecycle.kind === "returned"
            ? `Returned to inventory${row.lifecycle.lastSaleName ? `, was in ${row.lifecycle.lastSaleName}` : ""}`
            : "New draft",
      }));
    },
    [saleId],
  );

  const formValues = useMemo(() => {
    if (!preview) return null;
    return {
      ...inventoryLotToAttachReviewRow(preview, "attach-review"),
      startTime: isoToFormString(start),
      endTime: isoToFormString(end),
    };
  }, [preview, start, end]);

  const validation = useMemo(
    () => (formValues ? validateAttachReviewSchedule(formValues, ctx) : null),
    [formValues, ctx],
  );
  const errors: { start?: string; end?: string; other?: string } = {};
  if (submitted && validation && !validation.ok) {
    const { startTime, endTime, ...rest } = validation.fieldErrors;
    if (startTime) errors.start = startTime;
    if (endTime) errors.end = endTime;
    const other = Object.values(rest).filter(Boolean);
    if (other.length > 0) errors.other = other.join(" ");
  }

  const violation =
    !inheritsTiming && formValues
      ? attachReviewScheduleViolation(
          { startTime: formValues.startTime, endTime: formValues.endTime },
          ctx,
        )
      : null;

  const syncToWindow = () => {
    if (!preview) return;
    const proposed = proposeLotTimesWithinWindow(preview, saleWindow);
    setStart(proposed.startTime.toISOString());
    setEnd(proposed.endTime.toISOString());
  };

  const submit = () => {
    if (!preview || !picked || !formValues) return;
    setSubmitted(true);
    setFailure(null);
    const checked = validateAttachReviewSchedule(formValues, ctx);
    if (!checked.ok) return;
    startTransition(async () => {
      if (attachReviewScheduleChanged(preview, formValues)) {
        const updated = await adminUpdateLotResultAction(picked.id, {
          startTime: checked.payload.startTime,
          endTime: checked.payload.endTime,
        });
        if (!updated.ok) {
          setFailure(formatSaleSetupActionError(updated));
          return;
        }
      }
      const attached = await adminAttachLotToSaleResultAction(saleId, picked.id, {
        via: "attach_endpoint",
      });
      if (!attached.ok) {
        setFailure(formatSaleSetupActionError(attached));
        return;
      }
      notify.success(`${preview.title} attached to the sale`);
      onAttached(picked.id, preview.title);
      onOpenChange(false);
    });
  };

  const windowText = `${formatStaffDateTime(saleWindow.startTime, { zoneLabel: true })} to ${formatStaffDateTime(saleWindow.endTime, { zoneLabel: true })}`;
  const startingPence = preview ? moneyMinor(preview.startingPrice) : null;

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      title="Attach an existing lot"
      description={attachExistingLotPanelBody(inheritsTiming)}
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            type="submit"
            form={FORM_ID}
            variant="primary"
            loading={busy}
            disabled={!preview || loadingPreview}
          >
            Attach to sale
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        {previewError ? (
          <Notice tone="danger" alert title="That lot could not be loaded">
            {previewError}
          </Notice>
        ) : null}

        {preview ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <KeyValueList
                className="min-w-0 flex-1"
                items={[
                  { label: "Lot", value: preview.title },
                  {
                    label: "Auction type",
                    value: resolveLotAuctionTypePresentation(preview.auctionType).label,
                  },
                  {
                    label: "Starting price",
                    value: startingPence === null ? null : formatStaffMoney(startingPence),
                    numeric: true,
                  },
                  {
                    label: "Categories",
                    value: categoryLabel(formValues?.categoryIds ?? [], categories),
                  },
                ]}
              />
              <StaffButton
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void choose(null)}
              >
                {attachLotChangeLotLabel()}
              </StaffButton>
            </div>
            {errors.other ? (
              <Notice tone="danger" alert title="This lot is not ready to attach">
                {errors.other} Fix it on the lot page, then attach it.
              </Notice>
            ) : null}
            {inheritsTiming ? (
              <Notice tone="info" title="Lot times follow the sale">
                An onsite sale sets every lot's times, {windowText}.
              </Notice>
            ) : (
              <>
                {violation ? (
                  <Notice
                    tone="warning"
                    title="The lot's times do not fit the sale"
                    actions={
                      <StaffButton variant="secondary" size="sm" onClick={syncToWindow}>
                        {syncLotsToSaleWindowLabel(1)}
                      </StaffButton>
                    }
                  >
                    {attachLotScheduleConflictBanner()}
                  </Notice>
                ) : null}
                <LotWindowFields
                  start={start}
                  end={end}
                  onStartChange={setStart}
                  onEndChange={setEnd}
                  startError={errors.start}
                  endError={errors.end}
                  disabled={busy}
                />
                <p className="text-staff-xs text-staff-muted">
                  The sale runs {windowText}. Lot times must fall within it.
                </p>
              </>
            )}
          </>
        ) : (
          <Field label="Lot" disabled={busy || loadingPreview}>
            <EntityPicker
              value={picked?.id ?? null}
              selected={picked}
              onValueChange={(option) => void choose(option)}
              search={searchLots}
              placeholder={loadingPreview ? "Loading lot…" : "Search lots by title"}
              searchPlaceholder="Search lots by title"
              emptyText="No lots in inventory match."
            />
          </Field>
        )}
      </form>
    </StaffDialog>
  );
}
