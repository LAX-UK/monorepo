import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type {
  IAttachmentLinks,
  IConsignmentSpecialistAssigner,
} from "./consignment-message.ports.js";

/** Assigns through the submission's own assignment, so the inbox and the review queue agree. */
export class SubmissionSpecialistAssigner implements IConsignmentSpecialistAssigner {
  constructor(private readonly admin: Pick<IItemSubmissionAdminApi, "assignForAdminApi">) {}

  async assign(input: {
    staffUserId: string;
    submissionId: string;
    assignedToUserId: string | null;
  }): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const result = await this.admin.assignForAdminApi(
      input.staffUserId,
      input.submissionId,
      input.assignedToUserId,
    );
    return result.isOk()
      ? { ok: true }
      : { ok: false, status: result.error.status, message: result.error.message };
  }
}

/** Object links as the documents use them: public, or signed when storage is private. */
export class StorageAttachmentLinks implements IAttachmentLinks {
  constructor(
    private readonly storage: Pick<IObjectStorage, "getPublicUrl">,
    private readonly media: Pick<MediaUrlResolver, "resolveMany"> | undefined,
  ) {}

  async linksFor(keys: readonly string[]): Promise<string[]> {
    const bases = keys.map((key) => this.storage.getPublicUrl(key));
    return this.media ? this.media.resolveMany(bases) : bases;
  }
}
