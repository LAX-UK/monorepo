"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { editorialFieldId } from "@/components/editorial/editorial-field-parts.client";
import { type ShopMediaKind, uploadShopMediaFile } from "@/lib/shop-media-upload.client";
import { Field, FileDropzone, StaffButton, useStaffCan } from "@auction/staff-ui";
import { ImageIcon, Trash2 } from "@auction/staff-ui/icons";
import { type ReactNode, useState } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Upload = { fileName: string; progress: number } | null;

/**
 * One image on the shared media pipeline (presign, direct upload, confirm): a drop area to
 * upload, then the picture with Replace and Remove. The stored key is never shown; a picture
 * set earlier shows as "Image set" until a new one is uploaded here.
 */
export function EditorialImageField({
  name,
  label,
  description,
  kind,
  value,
  onChange,
  alt,
  optional = true,
  disabled = false,
}: {
  /** Names the control for the form's error summary. */
  name: string;
  label: string;
  description?: ReactNode;
  kind: ShopMediaKind;
  /** The stored media key, or null for no image. */
  value: string | null;
  /** The public URL comes with a fresh upload, for forms that store the address as well. */
  onChange: (mediaKey: string | null, publicUrl?: string) => void;
  /** Alt text recorded with the upload, when the caller owns it. */
  alt?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  const readOnly = !useStaffCan("editorial.write");
  const resolveImage = useStaffCatalogueImage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function take(files: File[]) {
    const file = files[0];
    if (!file) return;
    setFailure(null);
    setUpload({ fileName: file.name, progress: 0 });
    try {
      const confirmed = await uploadShopMediaFile({
        kind,
        file,
        ...(alt !== undefined ? { alt } : {}),
        onProgress: (loaded, total) =>
          setUpload({
            fileName: file.name,
            progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
          }),
      });
      setPreviewUrl(confirmed.publicUrl);
      onChange(confirmed.key, confirmed.publicUrl);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The upload failed. Try again.");
    } finally {
      setUpload(null);
    }
  }

  // A stored key has no address to show; seed paths load from the storefront that serves them.
  const stored = resolveImage(value);
  const picture = previewUrl ?? (stored && /^https?:\/\//i.test(stored) ? stored : null);

  return (
    <Field
      label={label}
      id={editorialFieldId(name)}
      disabled={disabled}
      error={failure}
      {...(description ? { description } : {})}
      {...(optional ? { optional } : {})}
    >
      <div className="flex flex-col gap-3">
        {value ? (
          <div className="flex items-center gap-3 rounded-staff-lg border border-staff-line px-3 py-2.5">
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-staff-sm border border-staff-line bg-staff-sunken">
              {picture ? (
                <img src={picture} alt="" className="size-full object-cover" />
              ) : (
                <ImageIcon aria-hidden className="size-5 text-staff-subtle" />
              )}
            </span>
            <p className="min-w-0 flex-1 text-staff-sm font-medium text-staff-fg">Image set</p>
            <StaffButton
              type="button"
              variant="ghost"
              size="sm"
              requires="editorial.write"
              icon={<Trash2 aria-hidden />}
              disabled={disabled}
              onClick={() => {
                setPreviewUrl(null);
                onChange(null);
              }}
            >
              Remove image
            </StaffButton>
          </div>
        ) : null}
        {upload ? (
          <output className="flex items-center gap-3 rounded-staff-lg border border-staff-line px-3 py-2 text-staff-sm">
            <span className="min-w-0 flex-1 truncate text-staff-fg">{upload.fileName}</span>
            <span className="shrink-0 text-staff-xs text-staff-muted tabular-nums">
              {upload.progress}%
            </span>
          </output>
        ) : null}
        {readOnly ? (
          value ? null : (
            <p className="text-staff-sm text-staff-muted">No image.</p>
          )
        ) : (
          <FileDropzone
            label={value ? "Replace image" : "Upload image"}
            hint="JPEG, PNG or WebP."
            accept={ACCEPT}
            disabled={disabled || upload !== null}
            onFiles={(files) => void take(files)}
          />
        )}
      </div>
    </Field>
  );
}
