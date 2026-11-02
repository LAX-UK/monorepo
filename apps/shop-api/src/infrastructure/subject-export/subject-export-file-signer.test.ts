import { describe, expect, it, vi } from "vitest";
import {
  SUBJECT_EXPORT_FILE_LINK_SECONDS,
  SubjectExportFileSigner,
} from "./subject-export-file-signer.js";

const NOW = new Date("2026-11-02T10:00:00Z");

function signer(
  extractKey = (v: string) => (v.startsWith("https://cdn.example/") ? v.slice(20) : null),
) {
  const createPresignedGet = vi.fn().mockResolvedValue({ url: "https://signed.example/x?sig=1" });
  return {
    createPresignedGet,
    signer: new SubjectExportFileSigner({ createPresignedGet, extractKey }, () => NOW),
  };
}

describe("SubjectExportFileSigner", () => {
  it("returns a short-lived signed link, never the bytes", async () => {
    const { signer: s, createPresignedGet } = signer();
    const ref = await s.sign({
      keyOrUrl: "uploads/a.pdf",
      fileName: "a.pdf",
      contentType: "application/pdf",
      byteSize: 10,
    });
    expect(ref).toEqual({
      url: "https://signed.example/x?sig=1",
      fileName: "a.pdf",
      contentType: "application/pdf",
      byteSize: 10,
      expiresAt: "2026-11-02T10:15:00.000Z",
    });
    expect(createPresignedGet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "uploads/a.pdf",
        expiresInSec: SUBJECT_EXPORT_FILE_LINK_SECONDS,
      }),
    );
    expect(SUBJECT_EXPORT_FILE_LINK_SECONDS).toBeLessThanOrEqual(900);
  });

  it("accepts a stored URL that belongs to Bid's storage", async () => {
    const { signer: s, createPresignedGet } = signer();
    await s.sign({ keyOrUrl: "https://cdn.example/photos/1.jpg", fileName: "1.jpg" });
    expect(createPresignedGet).toHaveBeenCalledWith(
      expect.objectContaining({ key: "photos/1.jpg" }),
    );
  });

  it("does not sign an address outside Bid's storage", async () => {
    const { signer: s, createPresignedGet } = signer();
    expect(
      await s.sign({ keyOrUrl: "https://elsewhere.example/x.jpg", fileName: "x.jpg" }),
    ).toBeNull();
    expect(createPresignedGet).not.toHaveBeenCalled();
  });

  it("keeps a hostile file name out of the download header", async () => {
    const { signer: s, createPresignedGet } = signer();
    await s.sign({ keyOrUrl: "k/a.pdf", fileName: 'a"; x=y\r\n.pdf' });
    const header = createPresignedGet.mock.calls[0]?.[0].responseContentDisposition as string;
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/"/g)).toHaveLength(2);
  });
});
