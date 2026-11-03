import { ENQUIRY_MAX_FILES_PER_DRAFT, isEnquiryUploadKind } from "@auction/domain";
import type { IUploadPersistenceRepository, UploadOwner } from "@auction/persistence/interfaces";

export type UploadAdmission =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

/** A rule that can turn an upload away before a link is issued, for the kinds it cares about. */
export interface IUploadAdmission {
  check(kind: string, owner: UploadOwner): Promise<UploadAdmission>;
}

/** Lets every upload through; used where no kind has a limit on how many may be waiting. */
export const admitAllUploads: IUploadAdmission = {
  async check() {
    return { ok: true };
  },
};

/**
 * An enquiry takes at most eight files, so a draft (or a signed-in sender) cannot park more than
 * that in storage waiting to be sent. Files already sent with an enquiry no longer count.
 */
export class EnquiryUploadAdmission implements IUploadAdmission {
  constructor(
    private readonly uploads: Pick<IUploadPersistenceRepository, "countUnsentEnquiryUploads">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async check(kind: string, owner: UploadOwner): Promise<UploadAdmission> {
    if (!isEnquiryUploadKind(kind)) return { ok: true };
    const waiting = await this.uploads.countUnsentEnquiryUploads(owner, this.now());
    if (waiting >= ENQUIRY_MAX_FILES_PER_DRAFT) {
      return {
        ok: false,
        status: 409,
        error: `Up to ${ENQUIRY_MAX_FILES_PER_DRAFT} files can be added to one enquiry.`,
        code: "too_many_files",
      };
    }
    return { ok: true };
  }
}
