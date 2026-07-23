"use client";

import { MediaImage } from "@/components/ui/media-image";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";
import {
  catalogImageAccept,
  catalogImageHelperCopy,
  getCatalogImagePolicy,
} from "@/lib/upload/upload-policies.client";
import { Button } from "@auction/ui/components/button";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { CatalogMediaDropzone } from "./catalog-media-dropzone";
import { CatalogMediaUploadQueue } from "./catalog-media-upload-queue";

type Props = {
  kind: CatalogImageUploadKind;
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  previewUrlByKey?: Record<string, string>;
  shape?: "rect" | "circle";
  inputId?: string;
};

/** Single-slot image field with shared policy, dropzone, queue, preview, replace, and remove. */
export function CatalogSingleImageField({
  kind,
  value,
  onChange,
  disabled = false,
  previewUrlByKey = {},
  shape = "rect",
  inputId,
}: Props) {
  const policy = getCatalogImagePolicy(kind);
  const keys = value ? [value] : [];
  const resolvedInputId = inputId ?? `catalog-single-image-${kind}`;

  const { items, uploadFiles, retry } = useUploadGallery({
    kind,
    value: keys,
    maxFiles: 1,
    onChange: (next) => onChange(next[0] ?? null),
    onError: (message) => notify.error("Upload failed", { description: message }),
  });

  const displaySrc = value ? (previewUrlByKey[value] ?? value) : null;
  const hasImage = Boolean(value);

  return (
    <div className="space-y-3">
      {!hasImage ? (
        <CatalogMediaDropzone
          inputId={resolvedInputId}
          title={policy.dropzoneTitle}
          description={catalogImageHelperCopy(kind)}
          accept={catalogImageAccept(kind)}
          multiple={false}
          disabled={disabled}
          compact
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
        <>
          <div className={shape === "circle" ? "max-w-40" : "max-w-sm"}>
            <MediaImage
              src={displaySrc ?? ""}
              alt={policy.placeholderLabel}
              label={policy.placeholderLabel}
              shape={shape}
              aspect={[1, 1]}
              sizes={shape === "circle" ? "160px" : "320px"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FileUploadTrigger
              disabled={disabled}
              accept={catalogImageAccept(kind)}
              inputId={`${resolvedInputId}-replace`}
              onFilesSelected={(files) => {
                void uploadFiles(files, { replace: true });
              }}
            >
              Replace image
            </FileUploadTrigger>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          </div>
          <CatalogMediaUploadQueue
            items={items}
            disabled={disabled}
            onRetry={(itemId) => void retry(itemId)}
          />
        </>
      )}
    </div>
  );
}
