import type { UploadStorage } from "../../../../lib/upload-storage.js";
import type { ImageObjectStore } from "./zoho-image-sync.service.js";

/** Stores Zoho pictures in the worker's upload storage, the bucket Shop serves artwork images from. */
export function createUploadStorageImageStore(storage: UploadStorage): ImageObjectStore {
  return {
    async exists(key) {
      return (await storage.headObject(key)) !== null;
    },
    async put(key, bytes, contentType) {
      await storage.putObject(key, bytes, contentType);
    },
  };
}
