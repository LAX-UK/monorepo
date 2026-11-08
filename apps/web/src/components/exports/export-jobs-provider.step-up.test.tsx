import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createExport = vi.hoisted(() => vi.fn());
const stepUp = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exports/export-api", () => {
  class ExportApiError extends Error {
    constructor(
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  return {
    ExportApiError,
    createExport: (...args: unknown[]) => createExport(...args),
    cancelExportJob: vi.fn(),
    downloadBlob: vi.fn(),
    fetchExportJob: vi.fn(),
    listExportJobs: vi.fn().mockResolvedValue([]),
    triggerExportDownload: vi.fn(),
  };
});
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  handleStaffStepUp: (code: unknown) => stepUp(code),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: (...args: unknown[]) => notifyError(...args),
  },
}));

const { ExportJobsProvider, useExportJobs } = await import("./export-jobs-provider");
const { ExportApiError } = await import("@/lib/exports/export-api");

function Starter({ onDone }: { onDone: (outcome: "resolved" | "threw") => void }) {
  const { startExport } = useExportJobs();
  useEffect(() => {
    startExport({ entityType: "users", format: "csv" } as never).then(
      () => onDone("resolved"),
      () => onDone("threw"),
    );
  }, [startExport, onDone]);
  return null;
}

function run() {
  const onDone = vi.fn();
  render(
    <ExportJobsProvider>
      <Starter onDone={onDone} />
    </ExportJobsProvider>,
  );
  return onDone;
}

describe("starting an export with a stale sign-in", () => {
  beforeEach(() => {
    createExport.mockReset();
    stepUp.mockReset();
    notifyError.mockReset();
  });

  it("sends staff to sign in again instead of showing a failure", async () => {
    createExport.mockRejectedValue(
      new ExportApiError("Recent sign-in required", "step_up_required"),
    );
    stepUp.mockReturnValue(true);
    const onDone = run();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("resolved"));
    expect(stepUp).toHaveBeenCalledWith("step_up_required");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("still reports other failures", async () => {
    createExport.mockRejectedValue(new ExportApiError("Export failed (500)"));
    stepUp.mockReturnValue(false);
    const onDone = run();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("threw"));
    expect(notifyError).toHaveBeenCalled();
  });
});
