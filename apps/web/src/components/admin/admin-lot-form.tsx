"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LotImageManager } from "@/components/admin/lot-image-manager";
import { CategoryPicker } from "@/components/forms/category-picker";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminCreateLotResultAction,
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import {
  type AdminLotFormValues,
  adminLotFormValuesSchema,
  formValuesToImageAltsPatch,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "@/lib/forms/schemas/admin-lot-form";
import { notify } from "@/lib/ui/notify";
import {
  type ArtistProfile,
  type CategoryNode,
  type LotAuctionType,
  type Sale,
  lotAuctionTypes,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { z as zod } from "zod";

type SaleOption = Pick<Sale, "id" | "title" | "status">;

type Props = {
  mode: "create" | "edit";
  lotId?: string;
  defaultValues: AdminLotFormValues;
  categories: CategoryNode[];
  /** Sales for the optional sale assignment picker. */
  sales?: SaleOption[];
  /** Pre-fetched canonical artists, used to resolve the selected chip when an
   * artistId is already attached. The picker still searches over the wire. */
  artists: ArtistProfile[];
  /** When true, only `english` is selectable unless the draft already uses a legacy type. */
  englishOnlyAuctionsLocked?: boolean;
};

function applyZodErrorsToForm(
  form: ReturnType<typeof useForm<AdminLotFormValues>>,
  path: (string | number)[],
  message: string,
): void {
  const key = path.length ? path.map(String).join(".") : "root";
  if (key === "root" || !path.length) {
    form.setError("root", { message });
    return;
  }
  form.setError(key as FieldPath<AdminLotFormValues>, { message });
}

export function AdminLotForm({
  mode,
  lotId,
  defaultValues,
  categories,
  sales = [],
  artists,
  englishOnlyAuctionsLocked = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const formSchema = useMemo(() => {
    if (!englishOnlyAuctionsLocked) return adminLotFormValuesSchema;
    return adminLotFormValuesSchema.superRefine((data, ctx) => {
      if (mode === "create" && data.auctionType !== "english") {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "Only the English auction type is available while English-only mode is on.",
          path: ["auctionType"],
        });
      }
      if (
        mode === "edit" &&
        defaultValues.auctionType === "english" &&
        data.auctionType !== "english"
      ) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "This draft is English-only; you cannot switch it to another auction type.",
          path: ["auctionType"],
        });
      }
    });
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType]);

  const form = useForm<AdminLotFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const auctionTypeOptions = useMemo((): readonly LotAuctionType[] => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    if (mode === "create") return ["english"];
    if (defaultValues.auctionType !== "english") return lotAuctionTypes;
    return ["english"];
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType]);

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            form.clearErrors("root");
            if (mode === "create") {
              const api = safeParseCreateLotFromForm(values);
              if (!api.success) {
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, iss.path, iss.message);
                }
                notify.error("Check the form for errors");
                return;
              }
              const r = await adminCreateLotResultAction(api.data);
              if (r.ok) {
                if (r.data?.id) {
                  const alts = await adminUpdateLotMarketingDetailsResultAction(
                    r.data.id,
                    formValuesToImageAltsPatch(values),
                  );
                  if (!alts.ok) {
                    notify.error("Draft created, but image alt text could not be saved", {
                      description: alts.error,
                    });
                  }
                }
                notify.success("Draft created");
                router.push(`/admin/lots/${r.data?.id}`);
                return;
              }
              notify.error(r.error);
              return;
            }
            if (!lotId) {
              notify.error("Missing lot");
              return;
            }
            const api = safeParseUpdateLotFromForm(values);
            if (!api.success) {
              for (const iss of api.error.issues) {
                applyZodErrorsToForm(form, iss.path, iss.message);
              }
              notify.error("Check the form for errors");
              return;
            }
            const r = await adminUpdateLotResultAction(lotId, api.data);
            if (r.ok) {
              const alts = await adminUpdateLotMarketingDetailsResultAction(
                lotId,
                formValuesToImageAltsPatch(values),
              );
              if (!alts.ok) {
                notify.error("Lot saved, but image alt text could not be saved", {
                  description: alts.error,
                });
                return;
              }
              notify.success("Saved");
              router.push(`/admin/lots/${lotId}`);
              return;
            }
            notify.error(r.error);
          });
        })}
      >
        <CatalogFormSection
          title="Identity"
          description="Public-facing title, description, and auction format."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Title</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="Lot title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="description" className="mb-2 block">
                  <LabelCaps>Description</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea id="description" rows={5} className="font-body text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="auctionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Lot type</LabelCaps>
                </FormLabel>
                <RhfSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={auctionTypeOptions.map((t) => ({ value: t, label: t }))}
                  triggerClassName="w-full font-body text-sm"
                />
                {englishOnlyAuctionsLocked ? (
                  <p className="mt-2 font-body text-xs text-on-surface-variant">
                    English-only mode is on: new drafts use the English auction type. Legacy
                    non-English lots still appear here until migrated.
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        </CatalogFormSection>

        <CatalogFormSection
          title="Sale & seller"
          description="Assign the owning legal entity and optional sale / paddle number."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="sellerLegalEntityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Seller (legal entity)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <AdminLegalEntityPicker
                    value={field.value || null}
                    displayLabel={form.watch("sellerDisplayName") ?? null}
                    onChange={(id, row) => {
                      field.onChange(id ?? "");
                      if (row) form.setValue("sellerDisplayName", row.displayName);
                    }}
                  />
                </FormControl>
                <p className="mt-2 font-body text-xs text-on-surface-variant">
                  The legal entity that owns this lot and receives payout.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="saleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Assign to sale (optional)</LabelCaps>
                  </FormLabel>
                  <select
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="mt-1 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body text-sm"
                  >
                    <option value="">— No sale —</option>
                    {sales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.status})
                      </option>
                    ))}
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lotNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Lot number (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput
                      type="number"
                      min={1}
                      placeholder="e.g. 42"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CatalogFormSection>

        <CatalogFormSection
          title="Catalogue & schedule"
          description="Artist, pricing, categories, bidding rules, schedule, and physical details."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="artistId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Artist / Maker / Brand</LabelCaps>
                </FormLabel>
                <FormControl>
                  <ArtistPicker
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id)}
                    selected={chipFromArtists(artists, field.value ?? null)}
                    helpText="Catalogue identity for this lot. Required before publish — sellers do not pick this themselves."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Starting price</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reservePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Reserve (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="buyNowPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Buy now (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyerPremiumRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Buyer premium (0–1)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="0.25" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="minBidIncrement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Min bid increment</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="1.00" {...field} />
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
                    <LabelCaps>Categories</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <CategoryPicker
                      categories={categories}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select categories"
                      multiple={true}
                    />
                  </FormControl>
                  <p className="mt-2 font-body text-xs text-on-surface-variant">
                    Choose one or more categories. The first selected is the primary.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Start (local)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      className="min-h-11 py-3 font-body text-sm"
                      {...field}
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
                    <LabelCaps>End (local)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      className="min-h-11 py-3 font-body text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="medium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Medium (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Dimensions (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CatalogFormSection>

        <CatalogFormSection
          title="Dutch options (optional)"
          description="Only used when the lot type is Dutch."
          collapsible={false}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="dutchDecrementAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Dutch decrement (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dutchDecrementIntervalMs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Dutch interval ms (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="60000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CatalogFormSection>

        <CatalogFormSection
          title="Images"
          description="Catalogue photos and alt text."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Lot images</LabelCaps>
                </FormLabel>
                <FormControl>
                  <LotImageManager
                    value={field.value.map((key, index) => ({
                      key,
                      alt: form.getValues("imageAlts")[index] ?? "",
                    }))}
                    onChange={(next) => {
                      field.onChange(next.map((item) => item.key));
                      form.setValue(
                        "imageAlts",
                        next.map((item) => item.alt),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CatalogFormSection>

        {form.formState.errors.root ? (
          <p className="text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="flex flex-col justify-end gap-3 border-t border-outline-variant/20 pt-6 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              router.push(
                mode === "create" ? "/admin/lots" : lotId ? `/admin/lots/${lotId}` : "/admin/lots",
              )
            }
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full sm:min-w-40 sm:w-auto"
          >
            {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function chipFromArtists(
  artists: ArtistProfile[],
  artistId: string | null,
): ArtistChipModel | null {
  if (!artistId) return null;
  const found = artists.find((a) => a.id === artistId);
  if (!found) return null;
  return {
    id: found.id,
    displayName: found.displayName,
    slug: found.slug,
    kind: found.kind ?? "artist",
    status: found.status ?? "approved",
  };
}
