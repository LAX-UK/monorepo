import { randomUUID } from "node:crypto";
import type { IObjectStorage } from "./interfaces/object-storage.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForContentType(ct: string): string {
  switch (ct) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".bin";
  }
}

export class UploadService {
  constructor(private readonly storage: IObjectStorage) {}

  async uploadImage(body: Buffer, contentType: string): Promise<{ url: string }> {
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    if (body.length === 0 || body.length > MAX_BYTES) {
      throw new Error("Image must be between 1 byte and 5MB");
    }
    const key = `images/${randomUUID()}${extForContentType(contentType)}`;
    return this.storage.putObject(key, body, contentType);
  }
}
