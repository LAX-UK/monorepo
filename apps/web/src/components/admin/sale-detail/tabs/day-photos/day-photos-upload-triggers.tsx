"use client";

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
    <div className="mb-5 flex flex-wrap gap-3">
      <FileUploadTrigger
        dropzone
        disabled={disabled}
        multiple
        accept={ACCEPT_ALL}
        inputId="sale-day-media-all"
        onFilesSelected={(files) => void onFilesSelected(files)}
        className="[&_[role=button]]:min-h-0 [&_[role=button]]:rounded-lg [&_[role=button]]:border-outline-variant [&_[role=button]]:bg-surface-container-lowest [&_[role=button]]:px-5 [&_[role=button]]:py-4 [&_[role=button]]:text-left"
      >
        <span className="block font-label text-xs uppercase tracking-[0.22em] text-secondary">
          Upload photos &amp; videos
        </span>
        <span className="mt-1 block font-body text-sm text-on-surface-variant">
          JPEG, PNG, WebP, MP4, WebM — drop here or click to choose
        </span>
      </FileUploadTrigger>
      <FileUploadTrigger
        disabled={disabled}
        accept={ACCEPT_IMAGES}
        capture="environment"
        inputId="sale-day-media-camera"
        onFilesSelected={(files) => void onFilesSelected(files)}
        className="sm:hidden"
      >
        Take photo
      </FileUploadTrigger>
      <FileUploadTrigger
        disabled={disabled}
        accept={ACCEPT_VIDEOS}
        capture="environment"
        inputId="sale-day-media-video"
        onFilesSelected={(files) => void onFilesSelected(files)}
        className="sm:hidden"
      >
        Record video
      </FileUploadTrigger>
    </div>
  );
}
