"use client";

import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import {
  type ArtworkFormImage,
  appendImages,
  makePrimaryImage,
  moveImage,
  removeImage,
} from "@/lib/artwork-form";
import { uploadShopMediaFile } from "@/lib/shop-media-upload.client";
import { ARTWORK_IMAGES_MAX, ARTWORK_IMAGE_ALT_MAX_LENGTH } from "@auction/shop-contracts";
import {
  FileDropzone,
  StaffButton,
  StaffTooltip,
  StatusBadge,
  TextInput,
  cn,
} from "@auction/staff-ui";
import { ArrowDown, ArrowUp, CircleAlert, Star, Trash2, X } from "@auction/staff-ui/icons";
import { useCallback, useId, useState } from "react";

type Upload = {
  id: string;
  fileName: string;
  progress: number;
  error: string | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * The artwork's gallery: upload through the shared media pipeline (presign, direct upload,
 * confirm), then order the images, choose the primary one (first, and the list thumbnail) and
 * describe each for screen readers. Order changes are announced.
 */
export function ArtworkMediaField({
  images,
  onChange,
  importedImageUrl,
  disabled = false,
  error,
  id,
}: {
  images: ArtworkFormImage[];
  onChange: (images: ArtworkFormImage[]) => void;
  /** An image URL from an earlier import, shown until images are uploaded here. */
  importedImageUrl: string | null;
  disabled?: boolean;
  error?: string | undefined;
  id: string;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const altBase = useId();
  const room = ARTWORK_IMAGES_MAX - images.length - uploads.filter((u) => !u.error).length;

  const patchUpload = useCallback((uploadId: string, patch: Partial<Upload>) => {
    setUploads((current) =>
      current.map((upload) => (upload.id === uploadId ? { ...upload, ...patch } : upload)),
    );
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      const accepted = files.slice(0, Math.max(room, 0));
      const started = accepted.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        progress: 0,
        error: null,
      }));
      setUploads((current) => [...current, ...started]);
      const done: ArtworkFormImage[] = [];
      await Promise.all(
        accepted.map(async (file, index) => {
          const item = started[index];
          if (!item) return;
          try {
            const confirmed = await uploadShopMediaFile({
              kind: "artwork_image",
              file,
              onProgress: (loaded, total) =>
                patchUpload(item.id, {
                  progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
                }),
            });
            done.push({
              mediaKey: confirmed.key,
              url: confirmed.publicUrl,
              alt: confirmed.alt ?? "",
            });
            setUploads((current) => current.filter((upload) => upload.id !== item.id));
          } catch (failure) {
            patchUpload(item.id, {
              error: failure instanceof Error ? failure.message : "Upload failed",
            });
          }
        }),
      );
      if (done.length > 0) {
        onChange(appendImages(images, done));
        setAnnouncement(`${done.length} ${done.length === 1 ? "image" : "images"} added`);
      }
    },
    [images, onChange, patchUpload, room],
  );

  const reorder = (next: ArtworkFormImage[], moved: ArtworkFormImage, message?: string) => {
    onChange(next);
    const position = next.findIndex((image) => image.mediaKey === moved.mediaKey) + 1;
    setAnnouncement(message ?? `Moved to position ${position} of ${next.length}`);
  };

  return (
    <div className="flex flex-col gap-3" id={id}>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {images.length === 0 && importedImageUrl ? (
        <div className="flex items-center gap-3 rounded-staff-lg border border-staff-line px-3 py-2.5">
          <ArtworkThumbnail url={importedImageUrl} size="md" />
          <div className="min-w-0 text-staff-sm">
            <p className="font-medium text-staff-fg">Imported image</p>
            <p className="text-staff-muted">
              Shown on the storefront until you upload images here.
            </p>
          </div>
        </div>
      ) : null}

      {images.length > 0 ? (
        <ol
          aria-label="Images, in display order"
          className="divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line"
        >
          {images.map((image, index) => {
            const altId = `${altBase}-alt-${index}`;
            const position = `image ${index + 1} of ${images.length}`;
            return (
              <li
                key={image.mediaKey}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ArtworkThumbnail url={image.url} size="md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label htmlFor={altId} className="text-staff-xs font-medium text-staff-muted">
                        Image {index + 1} description
                      </label>
                      {index === 0 ? <StatusBadge tone="info">Primary</StatusBadge> : null}
                    </div>
                    <TextInput
                      id={altId}
                      size="sm"
                      value={image.alt}
                      maxLength={ARTWORK_IMAGE_ALT_MAX_LENGTH}
                      placeholder="What the image shows, for screen readers"
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          images.map((current, position) =>
                            position === index ? { ...current, alt: event.target.value } : current,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  {index > 0 ? (
                    <StaffTooltip label="Make primary">
                      <StaffButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Make ${position} the primary image`}
                        disabled={disabled}
                        onClick={() =>
                          reorder(makePrimaryImage(images, index), image, "Now the primary image")
                        }
                      >
                        <Star aria-hidden />
                      </StaffButton>
                    </StaffTooltip>
                  ) : (
                    // Keeps every row's controls in the same columns as the rows below it.
                    <span aria-hidden className="size-control-sm" />
                  )}
                  <StaffTooltip label="Move up">
                    <StaffButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${position} up`}
                      disabled={disabled || index === 0}
                      onClick={() => reorder(moveImage(images, index, -1), image)}
                    >
                      <ArrowUp aria-hidden />
                    </StaffButton>
                  </StaffTooltip>
                  <StaffTooltip label="Move down">
                    <StaffButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${position} down`}
                      disabled={disabled || index === images.length - 1}
                      onClick={() => reorder(moveImage(images, index, 1), image)}
                    >
                      <ArrowDown aria-hidden />
                    </StaffButton>
                  </StaffTooltip>
                  <StaffTooltip label="Remove">
                    <StaffButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${position}`}
                      disabled={disabled}
                      onClick={() => {
                        onChange(removeImage(images, index));
                        setAnnouncement("Image removed");
                      }}
                    >
                      <Trash2 aria-hidden />
                    </StaffButton>
                  </StaffTooltip>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {uploads.length > 0 ? (
        <ul aria-label="Uploads" className="flex flex-col gap-2">
          {uploads.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-staff-lg border px-3 py-2 text-staff-sm",
                item.error ? "border-staff-danger/40 bg-staff-danger-bg" : "border-staff-line",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-staff-fg">{item.fileName}</span>
                  <span
                    className={cn(
                      "shrink-0 text-staff-xs tabular-nums",
                      item.error ? "text-staff-danger-fg" : "text-staff-muted",
                    )}
                  >
                    {item.error ? "Failed" : `${item.progress}%`}
                  </span>
                </div>
                {item.error ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-staff-xs text-staff-danger-fg">
                    <CircleAlert aria-hidden className="size-3.5 shrink-0" />
                    {item.error}
                  </p>
                ) : (
                  // The percentage beside the name is the readable value; the bar only shows it.
                  <div
                    aria-hidden
                    className="mt-1.5 h-1 overflow-hidden rounded-full bg-staff-sunken"
                  >
                    <div
                      className="h-full rounded-full bg-staff-ink transition-[width] duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {item.error ? (
                <StaffButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Dismiss ${item.fileName}`}
                  onClick={() => setUploads((current) => current.filter((u) => u.id !== item.id))}
                >
                  <X aria-hidden />
                </StaffButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <FileDropzone
        label={images.length > 0 ? "Add more images" : "Upload images"}
        hint={`JPEG, PNG or WebP. Up to ${ARTWORK_IMAGES_MAX} images; the first is the primary.`}
        accept={ACCEPT}
        multiple
        disabled={disabled || room <= 0}
        onFiles={(files) => void upload(files)}
      />
      {error ? (
        <p className="flex items-start gap-1.5 text-staff-xs font-medium text-staff-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
