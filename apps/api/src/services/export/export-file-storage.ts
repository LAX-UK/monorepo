import type { ExportEntityType, ExportFormat } from "@auction/exports";
import { exportFilename } from "@auction/exports";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import { exportObjectKey } from "./export-types.js";

const EXPORT_DOWNLOAD_TTL_SEC = 86400;

export interface IExportFileStorage {
  objectKey(exportId: string, format: ExportFormat): string;
  createDownloadUrl(input: {
    s3Key: string;
    entityType: ExportEntityType;
    format: ExportFormat;
  }): Promise<{ url: string; filename: string }>;
}

export class ExportFileStorage implements IExportFileStorage {
  constructor(private readonly objectStorage: IObjectStorage) {}

  objectKey(exportId: string, format: ExportFormat): string {
    return exportObjectKey(exportId, format);
  }

  async createDownloadUrl(input: {
    s3Key: string;
    entityType: ExportEntityType;
    format: ExportFormat;
  }) {
    const { url } = await this.objectStorage.createPresignedGet({
      key: input.s3Key,
      expiresInSec: EXPORT_DOWNLOAD_TTL_SEC,
    });
    return {
      url,
      filename: exportFilename(input.entityType, input.format),
    };
  }
}

export { EXPORT_DOWNLOAD_TTL_SEC };
