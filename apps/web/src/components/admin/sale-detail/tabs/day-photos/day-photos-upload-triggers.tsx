"use client";

import { CatalogMediaDropzone } from "@/components/admin/catalog/media";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { ACCEPT_ALL, ACCEPT_IMAGES, ACCEPT_VIDEOS } from "./day-media-types";

export function DayPhotosUploadTriggers({
  disabled,
  onFilesSelected,
}: {
  disabled: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
}) {
  return (
    <CatalogMediaDropzone
      inputId="sale-day-media-all"
      title="Add photos and videos"
      description="Drop JPEG, PNG, WebP, MP4, or WebM files here, or click to choose. Maximum 200 MB per file."
      accept={ACCEPT_ALL}
      disabled={disabled}
      busy={disabled}
      onFilesSelected={(files) => void onFilesSelected(files)}
      mobileActions={
        <div className="flex flex-wrap gap-2 sm:hidden">
          <FileUploadTrigger
            disabled={disabled}
            accept={ACCEPT_IMAGES}
            capture="environment"
            inputId="sale-day-media-camera"
            onFilesSelected={(files) => void onFilesSelected(files)}
          >
            Take photo
          </FileUploadTrigger>
          <FileUploadTrigger
            disabled={disabled}
            accept={ACCEPT_VIDEOS}
            capture="environment"
            inputId="sale-day-media-video"
            onFilesSelected={(files) => void onFilesSelected(files)}
          >
            Record video
          </FileUploadTrigger>
        </div>
      }
    />
  );
}
