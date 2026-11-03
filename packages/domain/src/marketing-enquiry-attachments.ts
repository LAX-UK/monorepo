/** The kinds of upload that can travel with an enquiry. */
export const ENQUIRY_UPLOAD_KINDS = ["enquiry_image", "enquiry_document"] as const;
export type EnquiryUploadKind = (typeof ENQUIRY_UPLOAD_KINDS)[number];

export function isEnquiryUploadKind(kind: string): kind is EnquiryUploadKind {
  return (ENQUIRY_UPLOAD_KINDS as readonly string[]).includes(kind);
}

export const ENQUIRY_MAX_IMAGES = 6;
export const ENQUIRY_MAX_DOCUMENTS = 2;
/** Everything one draft (or one signed-in sender) may have uploaded and not yet sent. */
export const ENQUIRY_MAX_FILES_PER_DRAFT = ENQUIRY_MAX_IMAGES + ENQUIRY_MAX_DOCUMENTS;

export const ENQUIRY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ENQUIRY_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ENQUIRY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ENQUIRY_DOCUMENT_TYPES = ["application/pdf"] as const;

/** Files that were never sent with an enquiry are removed after this long. */
export const ENQUIRY_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export type EnquiryAttachmentKind = "image" | "document";

const ATTACHMENT_KIND: Record<EnquiryUploadKind, EnquiryAttachmentKind> = {
  enquiry_image: "image",
  enquiry_document: "document",
};

const MAX_BY_ATTACHMENT_KIND: Record<EnquiryAttachmentKind, number> = {
  image: ENQUIRY_MAX_IMAGES,
  document: ENQUIRY_MAX_DOCUMENTS,
};

export function enquiryAttachmentKindOf(kind: EnquiryUploadKind): EnquiryAttachmentKind {
  return ATTACHMENT_KIND[kind];
}

export type UploadedEnquiryFile = { id: string; kind: EnquiryUploadKind; status: string };

export type PlannedEnquiryAttachment = {
  uploadObjectId: string;
  kind: EnquiryAttachmentKind;
  position: number;
};

/**
 * Which of the files a sender listed become attachments of the enquiry. Only files that passed
 * the worker's checks are kept; a rejected or unfinished file is left out and never stops the
 * enquiry from being sent. Each kind keeps its first files up to its limit, in the order sent.
 */
export function planEnquiryAttachments(files: readonly UploadedEnquiryFile[]): {
  claimed: PlannedEnquiryAttachment[];
  skipped: string[];
} {
  const claimed: PlannedEnquiryAttachment[] = [];
  const skipped: string[] = [];
  const taken = new Set<string>();
  const counts: Record<EnquiryAttachmentKind, number> = { image: 0, document: 0 };
  for (const file of files) {
    if (taken.has(file.id)) continue;
    taken.add(file.id);
    const kind = enquiryAttachmentKindOf(file.kind);
    if (file.status !== "active" || counts[kind] >= MAX_BY_ATTACHMENT_KIND[kind]) {
      skipped.push(file.id);
      continue;
    }
    claimed.push({ uploadObjectId: file.id, kind, position: counts[kind] });
    counts[kind] += 1;
  }
  return { claimed, skipped };
}

/** "digital-art" as "Digital art": a department as the sender picked it. */
export function enquiryDepartmentLabel(slug: string): string {
  const words = slug.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
