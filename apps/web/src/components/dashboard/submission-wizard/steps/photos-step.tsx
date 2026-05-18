"use client";

import type { StepProps } from "@/components/dashboard/submission-wizard/step-props";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { LabelCaps } from "@/components/ui/typography";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";

const labelClass =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export function PhotosStep({ form }: StepProps) {
  const imageCount = form.watch("images").length;

  return (
    <div className="space-y-6" data-testid="submission-wizard-step-photos">
      <FormField
        control={form.control}
        name="images"
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FormLabel className={labelClass}>
                <LabelCaps>Images</LabelCaps>
              </FormLabel>
              <span className="rounded-full border border-border-hairline bg-surface-container-low px-2.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                {imageCount} / 20
                {imageCount < 3 ? " · 3+ recommended" : ""}
              </span>
            </div>
            <p className="mb-2 font-body text-xs text-on-surface-variant">
              First image is the primary catalog image when approved. Include overall, detail, and
              signature or markings where relevant.
            </p>
            <ul className="mb-3 list-inside list-disc space-y-0.5 font-body text-xs text-on-surface-variant">
              <li>Sharp, colour-accurate photos in good light</li>
              <li>Scale reference or dimensions visible when helpful</li>
              <li>Drag to reorder after upload</li>
            </ul>
            <FormControl>
              <ImageGalleryManager
                kind="submission_image"
                label="Submission image"
                value={field.value}
                onChange={field.onChange}
                maxFiles={20}
                emptyTitle="No submission images yet"
                emptyDescription="Upload photos, then drag to reorder. The first image is the primary catalog image."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
