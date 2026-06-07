import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock server actions – they are "use server" and can't run in Vitest
vi.mock("@/lib/actions/admin-submissions", () => ({
  adminAcceptSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminStartSubmissionReviewResultAction: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { SubmissionInlineActions } from "./submission-inline-actions";

describe("SubmissionInlineActions", () => {
  it("shows only Start review when status is submitted", () => {
    render(<SubmissionInlineActions submissionId="abc" status="submitted" />);
    expect(screen.getByRole("button", { name: /start review/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  it("shows Accept and Reject but not Start review when status is under_review", () => {
    render(<SubmissionInlineActions submissionId="abc" status="under_review" />);
    expect(screen.queryByRole("button", { name: /start review/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("shows Convert to lot link when status is approved", () => {
    render(<SubmissionInlineActions submissionId="abc" status="approved" />);
    expect(screen.getByRole("link", { name: /convert to lot/i })).toHaveAttribute(
      "href",
      "/admin/submissions/abc/decision",
    );
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
