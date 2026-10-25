import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConditionReportFulfilForm } from "./condition-report-fulfil-form";

const fulfilAction = vi.fn();
const uploadFile = vi.fn();
const notifySuccess = vi.fn();
const onFulfilled = vi.fn();
const onDirtyChange = vi.fn();

vi.mock("@/lib/actions/admin", () => ({
  adminFulfilConditionReportResultAction: (...args: unknown[]) => fulfilAction(...args),
}));
vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({ uploadFile }),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));

function renderForm() {
  return render(
    <ConditionReportFulfilForm
      requestId="req_1"
      onFulfilled={onFulfilled}
      onDirtyChange={onDirtyChange}
    />,
  );
}

describe("ConditionReportFulfilForm", () => {
  beforeEach(() => {
    for (const fn of [fulfilAction, uploadFile, notifySuccess, onFulfilled, onDirtyChange]) {
      fn.mockReset();
    }
  });

  it("asks for something to publish before it submits, by the field and in the summary", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Fulfil and publish" }));
    expect(fulfilAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Add a summary, details or a file")).toHaveLength(2);
    expect(screen.getByRole("alert", { name: "There is a problem" })).toBeInTheDocument();
  });

  it("clears the error as soon as the field is fixed", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Fulfil and publish" }));
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "Minor foxing" } });
    expect(screen.queryByText("Add a summary, details or a file")).not.toBeInTheDocument();
  });

  it("publishes the trimmed text and the file, then reports it done", async () => {
    uploadFile.mockResolvedValue({ publicUrl: "https://cdn.example/report.pdf" });
    fulfilAction.mockResolvedValue({ ok: true });
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "  Good condition " } });
    fireEvent.change(screen.getByLabelText(/Internal note/), { target: { value: "Checked" } });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["pdf"], "report.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("report.pdf is ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fulfil and publish" }));
    await waitFor(() =>
      expect(fulfilAction).toHaveBeenCalledWith("req_1", {
        summary: "  Good condition ",
        details: "",
        responseNote: "Checked",
        downloadUrl: "https://cdn.example/report.pdf",
      }),
    );
    await waitFor(() => expect(onFulfilled).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalledWith("Condition report published");
  });

  it("keeps a failed publish in the form with what was typed", async () => {
    fulfilAction.mockResolvedValue({ ok: false, error: "The request is already closed" });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Details/), { target: { value: "Some wear" } });
    fireEvent.click(screen.getByRole("button", { name: "Fulfil and publish" }));
    expect(await screen.findByText("The request is already closed")).toBeInTheDocument();
    expect(screen.getByLabelText(/Details/)).toHaveValue("Some wear");
    expect(onFulfilled).not.toHaveBeenCalled();
  });

  it("reports unsaved changes so the panel asks before closing", () => {
    renderForm();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "x" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("shows an upload failure by the file field", async () => {
    uploadFile.mockRejectedValue(new Error("File type not allowed"));
    const { container } = renderForm();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] },
    });
    expect((await screen.findAllByText("File type not allowed")).length).toBeGreaterThan(0);
  });
});
