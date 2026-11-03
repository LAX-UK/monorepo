import { describe, expect, it } from "vitest";
import {
  S3SubjectExportReadSigner,
  safeDownloadFileName,
} from "./s3-subject-export-read-signer.js";

const NOW = new Date("2026-10-23T12:00:00.000Z");

describe("S3SubjectExportReadSigner", () => {
  const signer = new S3SubjectExportReadSigner({
    bucket: "lax-personal-exports",
    region: "lon1",
    endpoint: "https://lon1.digitaloceanspaces.com",
    accessKeyId: "read-key",
    secretAccessKey: "read-secret",
  });

  it("signs a GET for the one object that downloads as an attachment, for five minutes", async () => {
    const { url, expiresAt } = await signer.signDownload({
      objectKey: "subject-exports/e1/lax-data-2026-10-23.zip",
      fileName: "lax-data-2026-10-23.zip",
      expiresInSec: 300,
      now: NOW,
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toContain("subject-exports/e1/lax-data-2026-10-23.zip");
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(parsed.searchParams.get("X-Amz-Date")).toBe("20261023T120000Z");
    expect(parsed.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="lax-data-2026-10-23.zip"',
    );
    expect(parsed.searchParams.get("response-content-type")).toBe("application/zip");
    expect(expiresAt).toEqual(new Date("2026-10-23T12:05:00.000Z"));
  });

  it("keeps a worker-supplied file name from breaking out of the header", () => {
    expect(safeDownloadFileName('a"; filename="evil.exe')).toBe("a-filename-evil.exe");
    expect(safeDownloadFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeDownloadFileName("")).toBe("lax-data.zip");
  });
});
