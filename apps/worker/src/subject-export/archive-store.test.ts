import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { S3MultipartArchiveStore } from "./archive-store.js";

type Sent = { name: string; input: Record<string, unknown> };

function fakeClient(options: { failPart?: number } = {}) {
  const sent: Sent[] = [];
  return {
    sent,
    client: {
      async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
        const name = command.constructor.name;
        sent.push({ name, input: command.input });
        if (name === "CreateMultipartUploadCommand") return { UploadId: "upload-1" };
        if (name === "UploadPartCommand") {
          if (command.input.PartNumber === options.failPart) throw new Error("network");
          return { ETag: `etag-${command.input.PartNumber}` };
        }
        return {};
      },
    },
  };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "archive-store-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("S3MultipartArchiveStore", () => {
  it("uploads a file as ordered parts and completes with their tags", async () => {
    const path = join(dir, "a.zip");
    await writeFile(path, "0123456789"); // 10 bytes in parts of 4: 4 + 4 + 2
    const { client, sent } = fakeClient();
    await new S3MultipartArchiveStore("bucket", client as never, 4).uploadFile(
      "subject-exports/x/a.zip",
      path,
      "application/zip",
    );

    expect(sent.map((s) => s.name)).toEqual([
      "CreateMultipartUploadCommand",
      "UploadPartCommand",
      "UploadPartCommand",
      "UploadPartCommand",
      "CompleteMultipartUploadCommand",
    ]);
    expect(sent[0]?.input).toMatchObject({
      Bucket: "bucket",
      Key: "subject-exports/x/a.zip",
      ContentType: "application/zip",
      CacheControl: "private, no-store",
    });
    expect(sent.slice(1, 4).map((s) => (s.input.Body as Buffer).toString())).toEqual([
      "0123",
      "4567",
      "89",
    ]);
    expect(sent[4]?.input.MultipartUpload).toEqual({
      Parts: [
        { ETag: "etag-1", PartNumber: 1 },
        { ETag: "etag-2", PartNumber: 2 },
        { ETag: "etag-3", PartNumber: 3 },
      ],
    });
  });

  it("aborts the upload when a part fails, leaving no half-written object", async () => {
    const path = join(dir, "a.zip");
    await writeFile(path, "0123456789");
    const { client, sent } = fakeClient({ failPart: 2 });
    await expect(
      new S3MultipartArchiveStore("bucket", client as never, 4).uploadFile(
        "k",
        path,
        "application/zip",
      ),
    ).rejects.toThrow("network");
    expect(sent.at(-1)?.name).toBe("AbortMultipartUploadCommand");
    expect(sent.some((s) => s.name === "CompleteMultipartUploadCommand")).toBe(false);
  });

  it("sends an empty file as one empty part", async () => {
    const path = join(dir, "empty.zip");
    await writeFile(path, "");
    const { client, sent } = fakeClient();
    await new S3MultipartArchiveStore("bucket", client as never, 4).uploadFile(
      "k",
      path,
      "application/zip",
    );
    expect(sent.filter((s) => s.name === "UploadPartCommand")).toHaveLength(1);
  });

  it("deletes an object from its bucket", async () => {
    const { client, sent } = fakeClient();
    await new S3MultipartArchiveStore("bucket", client as never).deleteObject(
      "subject-exports/x/a.zip",
    );
    expect(sent[0]).toMatchObject({
      name: "DeleteObjectCommand",
      input: { Bucket: "bucket", Key: "subject-exports/x/a.zip" },
    });
  });
});
