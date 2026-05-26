"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { AdminLotPicker } from "@/components/admin/admin-lot-picker";
import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminAddLotToSaleResultAction,
  adminAttachLotToSaleResultAction,
  adminDetachLotFromSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  deliveryModeExplanation,
  emptySaleSetupLotRow,
  fieldTierSuffix,
  humanizeSetupError,
  lotSavedMessage,
  mergeSavedLotRow,
  mergeWizardRowsWithServerLots,
  safeParseSaleSetupLotRowForApi,
} from "@/lib/admin/sale-setup";
import { toDatetimeLocalValue } from "@/lib/forms/schemas/admin-lot-defaults";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { formatDateTime } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { lotAuctionTypes } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
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
import { saleModeInheritsLotTiming } from "@auction/validators";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

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
    startTime: toDatetimeLocalValue(lot.startTime),
    endTime: toDatetimeLocalValue(lot.endTime),
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
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<SaleSetupLotRowFormValues>({ defaultValues: row });
  const isSaved = Boolean(row.lotId);
  const isExisting = row.source === "existing";
  const inheritsTiming = saleModeInheritsLotTiming(ctx.deliveryMode);
  const saleStartLocal = toDatetimeLocalValue(ctx.saleStartTime);
  const saleEndLocal = toDatetimeLocalValue(ctx.saleEndTime);
  const lotStartValue = form.watch("startTime");
  const endTimeMin = lotStartValue?.trim() ? lotStartValue : saleStartLocal;
  const [attachLotId, setAttachLotId] = useState<string | null>(null);
  const [attachTitle, setAttachTitle] = useState<string | null>(null);

  useEffect(() => {
    form.reset(row);
  }, [form, row]);

  const attachExisting = useCallback(() => {
    if (!attachLotId) {
      notify.error("Choose a lot to attach");
      return;
    }
    startTransition(async () => {
      const r = await adminAttachLotToSaleResultAction(saleId, attachLotId, { via: "wizard" });
      if (!r.ok) {
        notify.error(actionFailureNotifyMessage(r.error));
        return;
      }
      notify.success(`Attached ${attachTitle ?? "lot"}`);
      onSaved(
        attachLotId,
        { ...row, title: attachTitle ?? row.title },
        attachTitle ? { title: attachTitle } : undefined,
      );
    });
  }, [attachLotId, attachTitle, onSaved, row, saleId]);

  const detachAttached = useCallback(() => {
    const lotId = row.lotId;
    if (!lotId) return;
    if (
      !window.confirm(
        "Detach this lot from the sale? It returns to inventory as a standalone draft lot.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await adminDetachLotFromSaleResultAction(saleId, lotId);
      if (!r.ok) {
        notify.error(actionFailureNotifyMessage(r.error));
        return;
      }
      notify.success(`Detached ${row.title || attachTitle || "lot"}`);
      onRemove();
      onDetached?.();
    });
  }, [attachTitle, onDetached, onRemove, row.lotId, row.title, saleId]);

  const auctionTypeOptions = useMemo(() => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    return ["english"] as const;
  }, [englishOnlyAuctionsLocked]);

  const save = useCallback(() => {
    startTransition(async () => {
      const values = form.getValues();
      const parsed = safeParseSaleSetupLotRowForApi(values, ctx);
      if (!parsed.success) {
        for (const iss of parsed.error.issues) {
          const path = iss.path.join(".") || "title";
          form.setError(path as keyof SaleSetupLotRowFormValues, { message: iss.message });
        }
        notify.error("Check this lot for errors");
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

  if (isExisting && isSaved) {
    return (
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
              onClick={detachAttached}
              disabled={pending}
              aria-label="Detach lot from sale"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        <p className="font-body text-sm text-on-surface">
          {row.title || attachTitle || "Existing lot"}
        </p>
        <p className="mt-1 font-body text-xs text-on-surface-variant">
          Existing inventory lot attached to this sale.
        </p>
      </div>
    );
  }

  if (isExisting && !isSaved && !readOnly) {
    return (
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
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
        <AdminLotPicker
          value={attachLotId}
          displayLabel={attachTitle}
          excludeSaleId={saleId}
          onChange={(id, hit) => {
            setAttachLotId(id);
            setAttachTitle(hit?.title ?? null);
          }}
        />
        <LoadingButton
          type="button"
          loading={pending}
          onClick={attachExisting}
          className="mt-4 w-full sm:w-auto"
        >
          Attach to sale
        </LoadingButton>
      </div>
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
                <FormControl>
                  <AdminLegalEntityPicker
                    value={field.value || null}
                    displayLabel={form.watch("sellerDisplayName") ?? null}
                    onChange={(id, entity) => {
                      field.onChange(id ?? "");
                      if (entity) form.setValue("sellerDisplayName", entity.displayName);
                    }}
                    disabled={readOnly || isSaved}
                  />
                </FormControl>
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
                  <select
                    {...field}
                    disabled={readOnly || isSaved || englishOnlyAuctionsLocked}
                    className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body text-sm"
                  >
                    {auctionTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
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
                      <FormControl>
                        <UnderlineInput
                          {...field}
                          type="datetime-local"
                          min={saleStartLocal}
                          max={saleEndLocal}
                          disabled={readOnly || isSaved}
                        />
                      </FormControl>
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
                      <FormControl>
                        <UnderlineInput
                          {...field}
                          type="datetime-local"
                          min={endTimeMin}
                          max={saleEndLocal}
                          disabled={readOnly || isSaved}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="font-body text-xs text-on-surface-variant">
                Sale runs {formatDateTime(ctx.saleStartTime)} – {formatDateTime(ctx.saleEndTime)}{" "}
                (local). Lot times must fall within this window.
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
            <LoadingButton
              type="button"
              loading={pending}
              onClick={save}
              className="w-full sm:w-auto"
            >
              Save lot
            </LoadingButton>
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
    return [emptySaleSetupLotRow(crypto.randomUUID())];
  });

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

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>{deliveryModeExplanation(sale.deliveryMode)}</AlertDescription>
      </Alert>

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
        />
      ))}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { ...emptySaleSetupLotRow(crypto.randomUUID()), source: "new" },
              ])
            }
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden />
            Create new lot
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { ...emptySaleSetupLotRow(crypto.randomUUID()), source: "existing" },
              ])
            }
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden />
            Add existing lot
          </Button>
        </div>
      ) : null}

      {unsavedCount > 0 ? (
        <p className="font-body text-sm text-error" role="alert">
          Save {unsavedCount} unsaved lot{unsavedCount === 1 ? "" : "s"} before continuing.
        </p>
      ) : null}
    </div>
  );
}

export function saleLotRowsHaveUnsaved(rows: SaleSetupLotRowFormValues[]): boolean {
  return rows.some((r) => !r.lotId);
}

export function saleLotRowsCountSaved(rows: SaleSetupLotRowFormValues[]): number {
  return rows.filter((r) => r.lotId).length;
}
