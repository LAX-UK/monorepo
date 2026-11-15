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
import { registerToaster, resetToastBridge } from "@/lib/ui/toast-bridge";

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToastBridge();
    // A toaster is on screen, so a raised toast runs as soon as the library has loaded.
    registerToaster();
  });

  /** The library loads on the first toast; let that settle. */
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("success merges default duration", async () => {
    notify.success("Done");
    await settled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Done", { duration: 6000 });
  });

  it("error merges longer default duration", async () => {
    notify.error("Failed");
    await settled();
    expect(mocks.toastError).toHaveBeenCalledWith("Failed", { duration: 8000 });
  });

  it("error forwards action and cancel buttons", async () => {
    const onSignIn = vi.fn();
    const onReset = vi.fn();
    notify.error("Already registered", {
      id: "signup-email-already-registered",
      action: { label: "Sign in", onClick: onSignIn },
      cancel: { label: "Reset password", onClick: onReset },
    });
    await settled();
    expect(mocks.toastError).toHaveBeenCalledWith("Already registered", {
      id: "signup-email-already-registered",
      duration: 8000,
      action: { label: "Sign in", onClick: onSignIn },
      cancel: { label: "Reset password", onClick: onReset },
    });
  });

  it("info requires id and forwards description", async () => {
    notify.info("Hello", { id: "x", description: "d" });
    await settled();
    expect(mocks.toastInfo).toHaveBeenCalledWith("Hello", {
      id: "x",
      duration: 6000,
      description: "d",
    });
  });

  it("warning forwards opts", async () => {
    notify.warning("Careful", { id: "w", duration: 4000 });
    await settled();
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
    await settled();
    expect(mocks.toastPromise).toHaveBeenCalledWith(p, {
      loading: "…",
      success: "ok",
      error: "bad",
    });
  });

  it("dismiss delegates", async () => {
    notify.success("Done");
    notify.dismiss("id-1");
    await settled();
    expect(mocks.toastDismiss).toHaveBeenCalledWith("id-1");
  });

  it("dismiss does nothing before any toast is raised", async () => {
    notify.dismiss();
    await settled();
    expect(mocks.toastDismiss).not.toHaveBeenCalled();
  });

  it("holds a toast until a toaster is on screen", async () => {
    resetToastBridge();
    notify.success("Saved");
    await settled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    registerToaster();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Saved", { duration: 6000 });
  });
});
