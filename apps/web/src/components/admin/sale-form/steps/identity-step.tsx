"use client";

import { CatalogMediaCollectionActions } from "@/components/admin/catalog/media";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { CategoryNode } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { Textarea } from "@auction/ui/components/textarea";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  type StreamUrlVerificationGate,
  StreamUrlVerifyControl,
} from "../stream-url-verify-control";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  categories: CategoryNode[];
  pending: boolean;
  previewUrlByKey: Record<string, string>;
  initialHeroVideoUrl?: string;
  heroVideoUrlGateRef?: RefObject<StreamUrlVerificationGate | null>;
};

function SaleCoverImagesField({
  value,
  onChange,
  disabled,
  previewUrlByKey,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  previewUrlByKey: Record<string, string>;
}) {
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const {
    showAdd,
    showManage,
    addButtonRef,
    manageButtonRef,
    closeAddPanel,
    toggleAdd,
    toggleManage,
  } = useMediaCollectionUi({
    collectionLength: value.length,
    inspectTarget: inspectIndex,
    setInspectTarget: setInspectIndex,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CatalogMediaCollectionActions
          addButtonRef={addButtonRef}
          manageButtonRef={manageButtonRef}
          showAdd={showAdd}
          showManage={showManage}
          onToggleAdd={toggleAdd}
          onToggleManage={toggleManage}
          addLabel="Add cover images"
          manageLabel="Manage"
        />
      </div>
      <ImageGalleryManager
        kind="sale_cover"
        label="Auction cover"
        value={value}
        onChange={onChange}
        maxFiles={20}
        disabled={disabled}
        previewUrlByKey={previewUrlByKey}
        emptyTitle="No cover images yet"
        emptyDescription="Upload cover images, then drag to reorder. The first image is the primary cover."
        showAddPanel={showAdd}
        onCloseAddPanel={closeAddPanel}
        showManage={showManage}
        inspectIndex={inspectIndex}
        onInspectIndex={setInspectIndex}
      />
    </div>
  );
}

export function SaleIdentityStep({
  form,
  categories,
  pending,
  previewUrlByKey,
  initialHeroVideoUrl = "",
  heroVideoUrlGateRef,
}: Props) {
  const heroPresentation = form.watch("heroPresentation");
  const heroBlurRef = useRef<(() => void) | null>(null);

  return (
    <div className="space-y-6">
      <CatalogFormSection
        title="Sale details"
        description="Core identifiers that appear across all public-facing materials and the catalog cover."
        collapsible={false}
        anchorId="sale-details"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Sale title</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput placeholder="Sale title" {...field} />
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
              <FormLabel className="mb-2 block">
                <LabelCaps>Description</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="description"
                  rows={4}
                  variant="underline"
                  className="font-body text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>

      <CatalogFormSection
        title="Sale media"
        description="Cover image and promotional visuals. Minimum resolution 2000 × 1500 px for print quality."
        collapsible={false}
        anchorId="sale-media"
      >
        <FormField
          control={form.control}
          name="coverImages"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Cover images</LabelCaps>
              </FormLabel>
              <p className="mb-2 font-body text-xs text-on-surface-variant">
                Image 1: desktop hero master. Image 2 (optional): mobile portrait crop. Image 3
                (optional): desktop xl crop for large screens.
              </p>
              <FormControl>
                <SaleCoverImagesField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  previewUrlByKey={previewUrlByKey}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>

      <CatalogFormSection
        title="Homepage hero"
        description="Choose how this sale appears in the lax.bid homepage hero when featured."
        collapsible={false}
        anchorId="sale-homepage-hero"
      >
        <FormField
          control={form.control}
          name="heroPresentation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Hero presentation</LabelCaps>
              </FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid gap-3 sm:grid-cols-2"
                  disabled={pending}
                >
                  <div className="flex items-start gap-3 rounded-md border border-outline-variant/40 p-3">
                    <RadioGroupItem
                      value="cover"
                      id="hero-presentation-cover"
                      aria-label="Cover images"
                      className="mt-1"
                    />
                    <Label htmlFor="hero-presentation-cover" className="cursor-pointer space-y-1">
                      <span className="block font-body text-sm font-medium">Cover images</span>
                      <span className="block font-body text-xs text-on-surface-variant">
                        Rotating sale cover slides (default).
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border border-outline-variant/40 p-3">
                    <RadioGroupItem
                      value="video"
                      id="hero-presentation-video"
                      aria-label="Video"
                      className="mt-1"
                    />
                    <Label htmlFor="hero-presentation-video" className="cursor-pointer space-y-1">
                      <span className="block font-body text-sm font-medium">Video</span>
                      <span className="block font-body text-xs text-on-surface-variant">
                        Marketing embed on the homepage — not the live saleroom feed.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {heroPresentation === "video" ? (
          <FormField
            control={form.control}
            name="heroVideoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Homepage hero video URL</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput
                    id="heroVideoUrl"
                    placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/event/…"
                    disabled={pending}
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      heroBlurRef.current?.();
                    }}
                  />
                </FormControl>
                <p className="mt-2 font-body text-xs text-on-surface-variant">
                  Shown on the lax.bid homepage when this sale is featured. Allowed: YouTube, Vimeo
                  (including live event links), Twitch, Cloudflare Stream.
                </p>
                {!pending ? (
                  <StreamUrlVerifyControl
                    value={field.value}
                    initialValue={initialHeroVideoUrl}
                    disabled={pending}
                    {...(heroVideoUrlGateRef ? { gateRef: heroVideoUrlGateRef } : {})}
                    blurHandlerRef={heroBlurRef}
                  />
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
      </CatalogFormSection>

      <CatalogFormSection
        title="Discovery & classification"
        description="Controls how this sale surfaces in collector search, curator filters, and internal reports."
        collapsible={false}
        anchorId="sale-discovery"
      >
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Theme category</LabelCaps>
              </FormLabel>
              <FormControl>
                <CategoryPicker
                  categories={categories}
                  value={field.value ? [field.value] : []}
                  onChange={(next) => field.onChange(next[0] ?? "")}
                  placeholder="Select a category (optional)"
                  multiple={false}
                />
              </FormControl>
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                Optional theme used for public sale discovery and internal filtering.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </CatalogFormSection>
    </div>
  );
}
