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
});
