"use client";

import {
  type ArtistApplicationFieldErrors,
  type ArtistApplicationWorkDraft,
  applicationFieldId,
} from "@/lib/artist-application/artist-application-form";
import {
  ARTIST_APPLICATION_IMAGE_ACCEPT,
  ARTIST_APPLICATION_IMAGE_MAX_LABEL,
} from "@/lib/artist-application/artist-application-upload";
import {
  MarketingCircleAlertIcon,
  MarketingCloseIcon,
  MarketingFormField,
  MarketingImageIcon,
  MarketingSpinnerIcon,
  MarketingTrashIcon,
} from "@auction/marketing-ui";
import type { MyArtistApplication } from "@auction/shop-contracts";
import { ARTIST_APPLICATION_LIMITS, type ArtistApplicationWorkKind } from "@auction/shop-domain";
import { FileUploadTrigger, RadioGroup, RadioGroupItem, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type DragEvent, useId, useState } from "react";
import { ApplicationTextField } from "./application-fields";
import { useApplicationUploads } from "./use-application-uploads.client";

const { minWorks, maxWorks } = ARTIST_APPLICATION_LIMITS;

const KIND_OPTIONS: ReadonlyArray<{ value: ArtistApplicationWorkKind; label: string }> = [
  { value: "original", label: "Original" },
  { value: "edition", label: "Edition" },
];

/** Where the count stands, in words: what is still needed, or how many more fit. */
export function workCountMessage(count: number): string {
  if (count >= maxWorks) return `${maxWorks} of ${maxWorks} works added.`;
  if (count < minWorks) {
    const missing = minWorks - count;
    return `${count} of ${maxWorks} works added. Add at least ${missing} more.`;
  }
  return `${count} works added. You can add up to ${maxWorks - count} more.`;
}

function WorkFields({
  work,
  index,
  errors,
  onChange,
  onRemove,
  disabled,
}: {
  work: ArtistApplicationWorkDraft;
  index: number;
  errors: ArtistApplicationFieldErrors;
  onChange: (change: Partial<ArtistApplicationWorkDraft>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const n = index + 1;
  const name = work.title.trim() || `Work ${n}`;
  const kindField = `works.${index}.kind`;
  const kindError = errors[kindField];
  return (
    <li
      className="grid gap-5 border-t border-outline-variant pt-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8"
      aria-label={`Work ${n} of the application`}
    >
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square overflow-hidden bg-surface-container-low">
          {work.imageUrl ? (
            <img
              src={work.imageUrl}
              alt={work.title.trim() ? work.title : `Image of work ${n}`}
              className="absolute inset-0 size-full object-contain p-2"
              loading="lazy"
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="min-h-11 w-fit gap-2 px-2 font-label text-on-surface-variant hover:text-on-surface"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
        >
          <MarketingTrashIcon className="size-4" />
          Remove
        </Button>
      </div>
      <div className="grid min-w-0 gap-6 sm:grid-cols-2">
        <ApplicationTextField
          className="sm:col-span-2"
          field={`works.${index}.title`}
          label="Title"
          maxLength={ARTIST_APPLICATION_LIMITS.workTitle}
          value={work.title}
          error={errors[`works.${index}.title`]}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <ApplicationTextField
          field={`works.${index}.year`}
          label="Year"
          inputMode="numeric"
          maxLength={4}
          placeholder="2024"
          value={work.year}
          error={errors[`works.${index}.year`]}
          onChange={(event) => onChange({ year: event.target.value.replace(/[^\d]/g, "") })}
        />
        <ApplicationTextField
          field={`works.${index}.size`}
          label="Size"
          placeholder="100 × 80 cm"
          maxLength={ARTIST_APPLICATION_LIMITS.workSize}
          value={work.size}
          error={errors[`works.${index}.size`]}
          onChange={(event) => onChange({ size: event.target.value })}
        />
        <ApplicationTextField
          className="sm:col-span-2"
          field={`works.${index}.medium`}
          label="Medium"
          placeholder="Oil on linen"
          maxLength={ARTIST_APPLICATION_LIMITS.workMedium}
          value={work.medium}
          error={errors[`works.${index}.medium`]}
          onChange={(event) => onChange({ medium: event.target.value })}
        />
        <MarketingFormField
          className="sm:col-span-2"
          id={applicationFieldId(kindField)}
          label="Original or edition"
          error={kindError ?? null}
        >
          {(control) => (
            <RadioGroup
              id={control.id}
              aria-invalid={control["aria-invalid"]}
              aria-describedby={control["aria-describedby"]}
              aria-label={`Is ${name} an original or an edition?`}
              value={work.kind}
              onValueChange={(value) => onChange({ kind: value as ArtistApplicationWorkKind })}
              className="flex flex-wrap gap-x-8 gap-y-2"
            >
              {KIND_OPTIONS.map((option) => {
                const optionId = `${control.id}-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={optionId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-on-surface"
                  >
                    <RadioGroupItem
                      id={optionId}
                      value={option.value}
                      className="size-5 border-input-border text-on-surface"
                      indicatorClassName="fill-on-surface"
                    />
                    {option.label}
                  </label>
                );
              })}
            </RadioGroup>
          )}
        </MarketingFormField>
      </div>
    </li>
  );
}

/**
 * Step 2: the works. Images are added from a button or by dropping them on the area; each one
 * uploads on its own and then asks for its title, year, medium, size and whether it is an
 * original or an edition. The count says what is still needed.
 */
export function ApplicationWorkStep({
  applicationId,
  works,
  errors,
  onWorkChange,
  onRemove,
  onUploaded,
}: {
  applicationId: string | null;
  works: readonly ArtistApplicationWorkDraft[];
  errors: ArtistApplicationFieldErrors;
  onWorkChange: (index: number, change: Partial<ArtistApplicationWorkDraft>) => void;
  onRemove: (index: number) => void;
  onUploaded: (application: MyArtistApplication) => void;
}) {
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const { uploads, busy, add, dismiss } = useApplicationUploads({
    applicationId,
    workCount: works.length,
    onUploaded,
  });
  const full = works.length >= maxWorks;
  const countError = errors.works;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (full) return;
    void add(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex flex-col gap-8">
      <div
        id={applicationFieldId("works")}
        tabIndex={-1}
        className={cn(
          "flex flex-col items-center gap-4 border border-dashed px-6 py-10 text-center outline-none transition-colors",
          dragging ? "border-on-surface bg-surface-container-low" : "border-input-border",
          countError && "border-error",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <MarketingImageIcon className="size-8 text-on-surface-variant" />
        <div className="flex flex-col gap-1">
          <p className="m-0 text-base font-medium text-on-surface">
            {full ? "Your application holds the most works it can" : "Add images of your work"}
          </p>
          <p id={hintId} className="m-0 text-sm leading-5 text-on-surface-variant">
            JPEG, PNG or WebP, up to {ARTIST_APPLICATION_IMAGE_MAX_LABEL} each. Drop them here or
            choose them from your device.
          </p>
        </div>
        <FileUploadTrigger
          accept={ARTIST_APPLICATION_IMAGE_ACCEPT}
          multiple
          disabled={full}
          busy={busy}
          describedById={hintId}
          dropzoneAriaLabel="Choose images of your work"
          onFilesSelected={(files) => void add(Array.from(files))}
          className="justify-items-center [&>button]:min-h-11 [&>button]:gap-2 [&>button]:px-6 [&>button]:font-label"
        >
          {busy ? <MarketingSpinnerIcon className="size-4" /> : null}
          {busy ? "Uploading…" : "Choose images"}
        </FileUploadTrigger>
      </div>

      <p
        className={cn(
          "m-0 text-sm font-medium leading-5",
          countError ? "text-error" : "text-on-surface-variant",
        )}
        aria-live="polite"
      >
        {countError ?? workCountMessage(works.length)}
      </p>

      {uploads.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Uploads">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className={cn(
                "flex items-center gap-3 border px-4 py-3 text-sm",
                upload.error ? "border-error text-on-surface" : "border-outline-variant",
              )}
            >
              {upload.error ? (
                <MarketingCircleAlertIcon className="size-4 text-error" />
              ) : (
                <MarketingSpinnerIcon className="size-4 text-on-surface-variant" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate">{upload.error ?? upload.name}</span>
                {upload.error ? null : (
                  <span className="block h-1 w-full overflow-hidden bg-surface-container-high">
                    <span
                      className="block h-full bg-on-surface transition-[width] duration-200"
                      style={{ width: `${Math.round((upload.progress ?? 1) * 100)}%` }}
                    />
                  </span>
                )}
              </div>
              {upload.error ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Dismiss the message about ${upload.name}`}
                  onClick={() => dismiss(upload.id)}
                >
                  <MarketingCloseIcon className="size-4" />
                </Button>
              ) : (
                <span className="shrink-0 font-label text-xs tabular-nums text-on-surface-variant">
                  {upload.progress === null ? "Checking" : `${Math.round(upload.progress * 100)}%`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {works.length > 0 ? (
        <ol
          className="m-0 flex list-none flex-col gap-8 p-0"
          aria-label="Works in your application"
        >
          {works.map((work, index) => (
            <WorkFields
              key={work.mediaKey}
              work={work}
              index={index}
              errors={errors}
              disabled={busy}
              onChange={(change) => onWorkChange(index, change)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
