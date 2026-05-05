import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(() => "id-1"),
  toastInfo: vi.fn(() => "id-2"),
  toastWarning: vi.fn(() => "id-3"),
  toastError: vi.fn(() => "id-4"),
  toastPromise: vi.fn((p: Promise<unknown>) => p),
  toastDismiss: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
    error: mocks.toastError,
    promise: mocks.toastPromise,
    dismiss: mocks.toastDismiss,
  },
}));

import { notify } from "@/lib/ui/notify";

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("success merges default duration", () => {
    notify.success("Done");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Done", { duration: 6000 });
  });

  it("error merges longer default duration", () => {
    notify.error("Failed");
    expect(mocks.toastError).toHaveBeenCalledWith("Failed", { duration: 8000 });
  });

  it("info requires id and forwards description", () => {
    notify.info("Hello", { id: "x", description: "d" });
    expect(mocks.toastInfo).toHaveBeenCalledWith("Hello", {
      id: "x",
      duration: 6000,
      description: "d",
    });
  });

  it("warning forwards opts", () => {
    notify.warning("Careful", { id: "w", duration: 4000 });
    expect(mocks.toastWarning).toHaveBeenCalledWith("Careful", {
      id: "w",
      duration: 4000,
    });
  });

  it("promise delegates to sonner", async () => {
    const p = Promise.resolve(1);
    await notify.promise(p, {
      loading: "…",
      success: "ok",
      error: "bad",
    });
    expect(mocks.toastPromise).toHaveBeenCalledWith(p, {
      loading: "…",
      success: "ok",
      error: "bad",
    });
  });

  it("dismiss delegates", () => {
    notify.dismiss("id-1");
    expect(mocks.toastDismiss).toHaveBeenCalledWith("id-1");
  });
});
