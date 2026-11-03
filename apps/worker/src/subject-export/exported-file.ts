import {
  SUBJECT_EXPORT_MAX_ARCHIVE_BYTES,
  type SubjectExportFileRef,
} from "@auction/identity-contracts";

const CAP_GB = SUBJECT_EXPORT_MAX_ARCHIVE_BYTES / 1024 ** 3;

export const FILE_OMITTED_REASONS = {
  size_cap: `Not included: the copy would pass the ${CAP_GB} GB limit. Ask us and we will send it separately.`,
  unavailable: "Not included: the stored file could not be found. Ask us and we will look into it.",
} as const;

export type FileOmittedReason = keyof typeof FILE_OMITTED_REASONS;

/** What a file reference becomes in the JSON once its file is in the ZIP. */
export type IncludedFile = {
  included: true;
  /** Path inside the ZIP, from the top folder. */
  path: string;
  fileName: string;
  contentType: string | null;
  byteSize: number;
  sha256: string;
};

/** What it becomes when the file is not in the ZIP: stated, never silently dropped. */
export type OmittedFile = {
  included: false;
  reason: FileOmittedReason;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  message: string;
};

export type ExportedFile = IncludedFile | OmittedFile;

export function omittedFile(ref: SubjectExportFileRef, reason: FileOmittedReason): OmittedFile {
  return {
    included: false,
    reason,
    fileName: ref.fileName,
    contentType: ref.contentType,
    byteSize: ref.byteSize,
    message: FILE_OMITTED_REASONS[reason],
  };
}
