"use client";

import {
  CatalogMediaDropzone,
  CatalogMediaUploadQueue,
  CatalogSingleImageField,
} from "@/components/admin/catalog/media";
import { MediaImage } from "@/components/ui/media-image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";
import {
  catalogImageAccept,
  catalogImageHelperCopy,
  getCatalogImagePolicy,
} from "@/lib/upload/upload-policies.client";
import { Button } from "@auction/ui/components/button";

/** Image-only upload kinds (presign + thumbnail UI). */
export type ImageUploadKind = CatalogImageUploadKind;

type ImageUploadFieldProps = {
  kind: ImageUploadKind;
  multiple?: boolean;
  maxFiles?: number;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  previewUrlByKey?: Record<string, string>;
};

export function ImageUploadField({
  kind,
  multiple = false,
  maxFiles = multiple ? 20 : 1,
  value,
  onChange,
  disabled = false,
  previewUrlByKey = {},
}: ImageUploadFieldProps) {
  if (!multiple && maxFiles === 1) {
    return (
      <CatalogSingleImageField
        kind={kind}
        value={value[0] ?? null}
        onChange={(next) => onChange(next ? [next] : [])}
        disabled={disabled}
        previewUrlByKey={previewUrlByKey}
        shape={kind === "avatar" ? "circle" : "rect"}
      />
    );
  }

  return (
    <MultiImageUploadField
      kind={kind}
      maxFiles={maxFiles}
      value={value}
      onChange={onChange}
      disabled={disabled}
      previewUrlByKey={previewUrlByKey}
    />
  );
}

function MultiImageUploadField({
  kind,
  maxFiles,
  value,
  onChange,
  disabled = false,
  previewUrlByKey = {},
}: Omit<ImageUploadFieldProps, "multiple"> & { maxFiles: number }) {
  const policy = getCatalogImagePolicy(kind);
  const remaining = Math.max(0, maxFiles - value.length);

  const { items, uploadFiles, retry } = useUploadGallery({
    kind,
    value,
    onChange,
    maxFiles,
    onError: (message) => notify.error("Upload failed", { description: message }),
  });

  function removeAt(index: number) {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  }

  function displaySrc(key: string): string {
    return previewUrlByKey[key] ?? key;
  }

  return (
    <div className="space-y-3">
      {remaining > 0 ? (
        <CatalogMediaDropzone
          inputId={`image-upload-${kind}`}
          title={policy.dropzoneTitle}
          description={catalogImageHelperCopy(kind, remaining)}
          accept={catalogImageAccept(kind)}
          disabled={disabled}
          onFilesSelected={(files) => void uploadFiles(files)}
          queue={
            <CatalogMediaUploadQueue
              items={items}
              disabled={disabled}
              onRetry={(itemId) => void retry(itemId)}
            />
          }
        />
      ) : (
        <p className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
          Maximum of {maxFiles} images reached. Remove an image before uploading another.
        </p>
      )}
      {value.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.map((urlOrKey, index) => (
            <div key={urlOrKey} className="rounded-md border border-outline-variant/30 p-2">
              <MediaImage
                src={displaySrc(urlOrKey)}
                alt={policy.placeholderLabel}
                label={policy.placeholderLabel}
                aspect={[1, 1]}
                sizes="(max-width: 640px) 100vw, 320px"
              />
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-auto px-2 py-1 text-xs"
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <MediaPlaceholder label={policy.placeholderLabel} aspect={[1, 1]} />
      )}
    </div>
  );
}
