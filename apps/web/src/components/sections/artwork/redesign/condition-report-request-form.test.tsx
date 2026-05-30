import { ConditionReportRequestForm } from "@/components/sections/artwork/redesign/condition-report-request-form";
import { CONDITION_REPORT_REQUEST_NOTE_MAX } from "@auction/validators";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ConditionReportRequestForm", () => {
  it("submits trimmed empty note", async () => {
    const onSubmitRequest = vi.fn().mockResolvedValue(true);
    render(
      <ConditionReportRequestForm
        onSubmitRequest={onSubmitRequest}
        submitting={false}
        apiErrorMessage={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /request condition report/i }));

    await waitFor(() => {
      expect(onSubmitRequest).toHaveBeenCalledWith({ requestNote: "" });
    });
  });

  it("shows field error when note exceeds max length", async () => {
    const onSubmitRequest = vi.fn();
    render(
      <ConditionReportRequestForm
        onSubmitRequest={onSubmitRequest}
        submitting={false}
        apiErrorMessage={null}
      />,
    );

    const textarea = screen.getByRole("textbox");
    const longNote = "x".repeat(CONDITION_REPORT_REQUEST_NOTE_MAX + 1);
    fireEvent.change(textarea, { target: { value: longNote } });
    fireEvent.click(screen.getByRole("button", { name: /request condition report/i }));

    await waitFor(() => {
      expect(screen.getByText(/2000 characters or fewer/i)).toBeInTheDocument();
    });
    expect(onSubmitRequest).not.toHaveBeenCalled();
  });

  it("shows API root error from prop", () => {
    render(
      <ConditionReportRequestForm
        onSubmitRequest={vi.fn()}
        submitting={false}
        apiErrorMessage="Lot not eligible"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Lot not eligible");
  });
});
