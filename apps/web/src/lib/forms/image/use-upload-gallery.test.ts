import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUploadGallery } from "./use-upload-gallery";

const uploadFile = vi.fn();

vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({ uploadFile }),
}));

describe("useUploadGallery", () => {
  beforeEach(() => {
    uploadFile.mockReset();
  });

  it("dedupes keys and calls onChange when upload succeeds", async () => {
    uploadFile.mockResolvedValue({ key: "new-key", uploadId: "u1" });
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useUploadGallery({
        kind: "lot_image",
        value: ["existing"],
        onChange,
        maxFiles: 5,
      }),
    );

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.uploadFiles([file]);
    });

    expect(onChange).toHaveBeenCalledWith(["existing", "new-key"]);
  });

  it("skips duplicate keys already in value", async () => {
    uploadFile.mockResolvedValue({ key: "existing", uploadId: "u1" });
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useUploadGallery({
        kind: "lot_image",
        value: ["existing"],
        onChange,
        maxFiles: 5,
      }),
    );

    const file = new File(["x"], "b.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.uploadFiles([file]);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("replaces a full single-slot value without clearing it before upload succeeds", async () => {
    uploadFile.mockResolvedValue({ key: "replacement", uploadId: "u2" });
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useUploadGallery({
        kind: "artist_image",
        value: ["existing"],
        onChange,
        maxFiles: 1,
      }),
    );

    const file = new File(["x"], "replacement.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.uploadFiles([file], { replace: true });
    });

    expect(uploadFile).toHaveBeenCalledWith(file, "artist_image");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(["replacement"]);
  });

  it("tracks duplicate file names as independent queue items", async () => {
    uploadFile
      .mockResolvedValueOnce({ key: "first", uploadId: "u1" })
      .mockResolvedValueOnce({ key: "second", uploadId: "u2" });
    const { result } = renderHook(() =>
      useUploadGallery({
        kind: "lot_image",
        value: [],
        onChange: vi.fn(),
        maxFiles: 5,
      }),
    );

    const first = new File(["1"], "same.jpg", { type: "image/jpeg" });
    const second = new File(["2"], "same.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.uploadFiles([first, second]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(new Set(result.current.items.map((item) => item.id)).size).toBe(2);
    expect(result.current.items.every((item) => item.status === "done")).toBe(true);
  });

  it("rejects files that violate the shared client upload policy before network upload", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useUploadGallery({
        kind: "avatar",
        value: [],
        onChange: vi.fn(),
        maxFiles: 1,
        onError,
      }),
    );

    const file = new File(["x"], "profile.gif", { type: "image/gif" });
    await act(async () => {
      await result.current.uploadFiles([file]);
    });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Unsupported file type.");
    expect(result.current.items[0]?.status).toBe("error");
  });
});
