import {
  ENQUIRY_DOCUMENT_MAX_BYTES,
  ENQUIRY_DOCUMENT_TYPES,
  ENQUIRY_IMAGE_MAX_BYTES,
  ENQUIRY_IMAGE_TYPES,
  ENQUIRY_MAX_DOCUMENTS,
  ENQUIRY_MAX_FILES_PER_DRAFT,
  ENQUIRY_MAX_IMAGES,
} from "@auction/domain";

export type UploadKindName = "image" | "document";
export type UploadState = "uploading" | "done" | "rejected";

/** One file in the enquiry's queue. */
export type UploadItem = {
  id: string;
  name: string;
  size: number;
  kind: UploadKindName;
  state: UploadState;
  /** 0 to 1 while uploading. */
  progress: number;
  /** Why the file was turned away, in words for the sender. */
  reason?: string | undefined;
  /** The server's id for the file once it has passed its checks. */
  uploadId?: string | undefined;
  /** A local preview of a photo; never sent anywhere. */
  previewUrl?: string | undefined;
};

export type PickedFile = { file: File; kind: UploadKindName; refusal: string | null };

const IMAGE_TYPES: readonly string[] = ENQUIRY_IMAGE_TYPES;
const DOCUMENT_TYPES: readonly string[] = ENQUIRY_DOCUMENT_TYPES;
const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

const MAX_BY_KIND: Record<UploadKindName, { count: number; refusal: string }> = {
  image: { count: ENQUIRY_MAX_IMAGES, refusal: `up to ${ENQUIRY_MAX_IMAGES} photos` },
  document: { count: ENQUIRY_MAX_DOCUMENTS, refusal: `up to ${ENQUIRY_MAX_DOCUMENTS} PDFs` },
};

function kindOf(file: File): UploadKindName | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (DOCUMENT_TYPES.includes(file.type)) return "document";
  return null;
}

/**
 * Checks each chosen file against the limits before anything is uploaded. A file that does not fit
 * is kept, with the reason, so the sender sees why. Files turned away earlier do not take up room.
 */
export function pickFiles(files: readonly File[], existing: readonly UploadItem[]): PickedFile[] {
  const counts: Record<UploadKindName, number> = { image: 0, document: 0 };
  for (const item of existing) if (item.state !== "rejected") counts[item.kind] += 1;

  return files.map((file) => {
    const kind = kindOf(file);
    if (!kind) {
      const refusal = file.type.startsWith("image/")
        ? "use JPEG, PNG or WebP"
        : "use JPEG, PNG or WebP, or a PDF";
      return { file, kind: "image", refusal };
    }
    const maxBytes = kind === "image" ? ENQUIRY_IMAGE_MAX_BYTES : ENQUIRY_DOCUMENT_MAX_BYTES;
    if (file.size <= 0) return { file, kind, refusal: "the file is empty" };
    if (file.size > maxBytes) return { file, kind, refusal: `larger than ${megabytes(maxBytes)}` };
    const total = counts.image + counts.document;
    if (counts[kind] >= MAX_BY_KIND[kind].count || total >= ENQUIRY_MAX_FILES_PER_DRAFT) {
      return { file, kind, refusal: MAX_BY_KIND[kind].refusal };
    }
    counts[kind] += 1;
    return { file, kind, refusal: null };
  });
}

/** Puts the picked files into the queue: accepted ones start uploading, the others show why not. */
export function addPicked(
  items: readonly UploadItem[],
  picked: readonly PickedFile[],
  newId: () => string,
): UploadItem[] {
  return [
    ...items,
    ...picked.map(
      ({ file, kind, refusal }): UploadItem => ({
        id: newId(),
        name: file.name,
        size: file.size,
        kind,
        state: refusal ? "rejected" : "uploading",
        progress: 0,
        ...(refusal ? { reason: refusal } : {}),
      }),
    ),
  ];
}

const update = (items: readonly UploadItem[], id: string, change: Partial<UploadItem>) =>
  items.map((item) => (item.id === id ? { ...item, ...change } : item));

export const markProgress = (items: readonly UploadItem[], id: string, progress: number) =>
  update(items, id, { progress: Math.min(1, Math.max(0, progress)) });

export const markDone = (items: readonly UploadItem[], id: string, uploadId: string) =>
  update(items, id, { state: "done", progress: 1, uploadId });

export const markRejected = (items: readonly UploadItem[], id: string, reason: string) =>
  update(items, id, { state: "rejected", reason: describeRejection(reason) });

export const removeItem = (items: readonly UploadItem[], id: string) =>
  items.filter((item) => item.id !== id);

/** The files to send with the enquiry: those that passed their checks, in the order shown. */
export function doneUploadIds(items: readonly UploadItem[]): string[] {
  return items.flatMap((item) => (item.state === "done" && item.uploadId ? [item.uploadId] : []));
}

const REJECTION_WORDS: Record<string, string> = {
  content_type_mismatch: "that isn't a valid photo or PDF",
  unsupported_content_type: "use JPEG, PNG or WebP, or a PDF",
  oversize: "larger than the limit",
  missing: "the upload didn't finish",
  malware: "we couldn't accept that file",
};

/** A reason from the worker as plain words; a sentence the API already wrote is kept as it is. */
export function describeRejection(reason: string): string {
  if (REJECTION_WORDS[reason]) return REJECTION_WORDS[reason];
  return /[.!]$/.test(reason) ? reason : "we couldn't accept that file";
}

export type SubmitButtonState = { label: string; busy: boolean; waiting: boolean };

const pluralise = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What the send button says: ready, waiting for files still being checked, or sending. */
export function submitButtonState(
  items: readonly UploadItem[],
  sending: boolean,
): SubmitButtonState {
  if (sending) return { label: "Sending…", busy: true, waiting: false };
  const pending = items.filter((item) => item.state === "uploading");
  if (pending.length === 0) return { label: "Send enquiry", busy: false, waiting: false };
  const kinds = new Set(pending.map((item) => item.kind));
  const noun = kinds.size > 1 ? "file" : kinds.has("document") ? "document" : "photo";
  return { label: `Waiting for ${pluralise(pending.length, noun)}…`, busy: true, waiting: true };
}
