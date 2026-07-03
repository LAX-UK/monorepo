import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { presentEntityDocumentsBatch } from "../lib/entity-document-presenter.js";
import type { IUploadObjectReader } from "../repositories/interfaces/upload-object.reader.js";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import type { IEntityDocumentRepository } from "./interfaces/repositories.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";

export class EntityDocumentError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "EntityDocumentError";
  }
}

export class EntityDocumentService<TKind extends string> {
  constructor(
    private readonly entityKind: DocumentEntityKind,
    private readonly repo: IEntityDocumentRepository<TKind>,
    private readonly uploadObjects: IUploadObjectReader,
    private readonly storage: IObjectStorage,
    private readonly media: MediaUrlResolver | undefined,
  ) {}

  async attach(args: {
    entityId: string;
    kind: TKind;
    label: string | null;
    uploadObjectId: string;
    userId: string;
  }): Promise<EntityDocument> {
    const status = await this.uploadObjects.getStatus(args.uploadObjectId);
    if (!status || status !== "active") {
      throw new EntityDocumentError("upload_not_active");
    }
    const row = await this.repo.attach({
      entityId: args.entityId,
      kind: args.kind,
      label: args.label,
      uploadObjectId: args.uploadObjectId,
      createdByUserId: args.userId,
    });
    const [doc] = await presentEntityDocumentsBatch(
      this.entityKind,
      [row],
      this.storage,
      this.media,
    );
    if (!doc) throw new EntityDocumentError("present_failed");
    return doc;
  }

  async list(entityId: string): Promise<EntityDocument[]> {
    const rows = await this.repo.listRowsForEntity(entityId);
    return presentEntityDocumentsBatch(this.entityKind, rows, this.storage, this.media);
  }

  async listForEntityIds(entityIds: string[]): Promise<Map<string, EntityDocument[]>> {
    const raw = await this.repo.listRowsForEntityIds(entityIds);
    const out = new Map<string, EntityDocument[]>();
    for (const [entityId, rows] of raw) {
      out.set(
        entityId,
        await presentEntityDocumentsBatch(this.entityKind, rows, this.storage, this.media),
      );
    }
    return out;
  }

  async remove(entityId: string, documentId: string): Promise<void> {
    return this.repo.remove(entityId, documentId);
  }
}
