import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock server actions – they are "use server" and can't run in Vitest
vi.mock("@/lib/actions/admin-submissions", () => ({
  adminApproveSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminStartSubmissionReviewResultAction: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { SubmissionInlineActions } from "./submission-inline-actions";

describe("SubmissionInlineActions", () => {
  it("shows Start review, Approve and Reject buttons when status is submitted", () => {
    render(<SubmissionInlineActions submissionId="abc" status="submitted" />);
    expect(screen.getByRole("button", { name: /start review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("shows Approve and Reject but not Start review when status is under_review", () => {
    render(<SubmissionInlineActions submissionId="abc" status="under_review" />);
    expect(screen.queryByRole("button", { name: /start review/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("renders nothing for terminal statuses", () => {
    const { container } = render(<SubmissionInlineActions submissionId="abc" status="approved" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for rejected status", () => {
    const { container } = render(<SubmissionInlineActions submissionId="abc" status="rejected" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for withdrawn status", () => {
    const { container } = render(<SubmissionInlineActions submissionId="abc" status="withdrawn" />);
    expect(container.firstChild).toBeNull();
  });
});
