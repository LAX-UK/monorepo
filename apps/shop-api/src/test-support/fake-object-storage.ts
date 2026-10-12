import type { ObjectStoragePort } from "@auction/object-storage";

export function createFakeObjectStorage(publicBaseUrl = "https://cdn.test"): ObjectStoragePort & {
  objects: Map<string, { body: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  const base = publicBaseUrl.replace(/\/$/, "");

  return {
    objects,
    async putObject(key, body, contentType) {
      objects.set(key, { body, contentType });
      return { url: `${base}/${key}` };
    },
    getPublicUrl(key) {
      return `${base}/${key}`;
    },
    async createPresignedPut(args) {
      return {
        url: `${base}/presigned/${args.key}`,
        requiredHeaders: { "content-type": args.contentType },
      };
    },
    async createPresignedGet(args) {
      return { url: `${base}/presigned-get/${args.key}` };
    },
    extractKey(value) {
      const prefix = `${base}/`;
      if (value.startsWith(prefix)) return value.slice(prefix.length);
      if (!value.includes("://")) return value.replace(/^\/+/, "");
      return null;
    },
    async headObject(key) {
      const row = objects.get(key);
      if (!row) return null;
      return { contentType: row.contentType, byteSize: row.body.byteLength, etag: "fake" };
    },
    async getObjectBytes(key, maxBytes) {
      const row = objects.get(key);
      if (!row) return null;
      return row.body.subarray(0, maxBytes);
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}
