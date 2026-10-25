"use client";

import { CatalogMediaCollectionActions } from "@/components/admin/catalog/media";
import {
  StaffEntityField,
  StaffRadioField,
  StaffTextAreaField,
  StaffTextField,
  staffFieldId,
} from "@/components/admin/forms/staff-form-fields";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import { useMediaCollectionUi } from "@/lib/admin/media/use-media-collection-ui";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { Field, FormSection, TextInput } from "@auction/staff-ui";
import type { CategoryNode } from "@auction/types";
import type { RefObject } from "react";
import { useMemo, useRef, useState } from "react";
import { type UseFormReturn, useController } from "react-hook-form";
import { SALE_FORM_ID } from "../sale-form-id";
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
    <div className="flex flex-col gap-4">
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
  const categoryOptions = useMemo(() => categoryPickerOptions(categories), [categories]);
  const covers = useController({ control: form.control, name: "coverImages" });
  const heroVideo = useController({ control: form.control, name: "heroVideoUrl" });
  const f = { control: form.control, formId: SALE_FORM_ID } as const;

  return (
    <>
      <FormSection
        title="Sale details"
        description="The title and description bidders see on the sale page and in every listing."
      >
        <StaffTextField {...f} name="title" label="Title" />
        <StaffTextAreaField {...f} name="description" label="Description" optional rows={4} />
      </FormSection>

      <FormSection
        title="Cover images"
        description="At least 2000 × 1500 px. The first image leads the sale page; drag to reorder."
      >
        <Field
          id={staffFieldId(SALE_FORM_ID, "coverImages")}
          label="Images"
          optional
          description="Image 1 is the desktop hero. Image 2 is the phone crop and image 3 the wide-screen crop; both are optional."
          error={covers.fieldState.error?.message}
        >
          <SaleCoverImagesField
            value={covers.field.value}
            onChange={covers.field.onChange}
            disabled={pending}
            previewUrlByKey={previewUrlByKey}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Homepage hero"
        description="How the sale appears at the top of the lax.bid homepage when it is featured."
      >
        <StaffRadioField
          {...f}
          name="heroPresentation"
          label="Show"
          disabled={pending}
          options={[
            {
              value: "cover",
              label: "Cover images",
              description: "The sale's cover images in turn.",
            },
            {
              value: "video",
              label: "Video",
              description: "A marketing video, not the live saleroom feed.",
            },
          ]}
        />
        {heroPresentation === "video" ? (
          <Field
            id={staffFieldId(SALE_FORM_ID, "heroVideoUrl")}
            label="Video link"
            description="YouTube, Vimeo (including live event links), Twitch or Cloudflare Stream."
            error={heroVideo.fieldState.error?.message}
          >
            <TextInput
              ref={heroVideo.field.ref}
              name={heroVideo.field.name}
              value={heroVideo.field.value ?? ""}
              placeholder="https://vimeo.com/event/…"
              disabled={pending}
              onChange={(event) => heroVideo.field.onChange(event.target.value)}
              onBlur={() => {
                heroVideo.field.onBlur();
                heroBlurRef.current?.();
              }}
            />
            {!pending ? (
              <StreamUrlVerifyControl
                value={heroVideo.field.value}
                initialValue={initialHeroVideoUrl}
                disabled={pending}
                {...(heroVideoUrlGateRef ? { gateRef: heroVideoUrlGateRef } : {})}
                blurHandlerRef={heroBlurRef}
              />
            ) : null}
          </Field>
        ) : null}
      </FormSection>

      <FormSection
        title="Discovery"
        description="Where the sale is listed in collector search and staff filters."
      >
        <StaffEntityField
          {...f}
          name="categoryId"
          label="Theme category"
          optional
          options={categoryOptions}
          placeholder="No theme"
          searchPlaceholder="Search categories"
          emptyText="No categories match."
        />
      </FormSection>
    </>
  );
}
