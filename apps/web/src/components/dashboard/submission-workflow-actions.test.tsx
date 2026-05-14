import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/submissions", () => ({
  submitForReviewFromValuesAction: vi.fn(),
  withdrawSubmissionFromValuesAction: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe("SubmissionWorkflowActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when no actions are available", () => {
    const { container } = render(
      <SubmissionWorkflowActions submissionId="s1" canSubmit={false} canWithdraw={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders submit when canSubmit", () => {
    render(<SubmissionWorkflowActions submissionId="s1" canSubmit canWithdraw={false} />);
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
  });
});
