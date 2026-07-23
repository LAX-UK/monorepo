import type { EntityDocument } from "@auction/types";

export interface ISubmissionDocumentPort {
  attach(args: {
    entityId: string;
    kind: string;
    label: string | null;
    uploadObjectId: string;
    userId: string;
  }): Promise<EntityDocument>;

  list(entityId: string): Promise<EntityDocument[]>;

  remove(entityId: string, documentId: string): Promise<void>;
}
