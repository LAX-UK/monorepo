import { SubmissionStatusGuide } from "@/components/dashboard/submissions/submission-status-guide";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SubmissionStatusGuide", () => {
  it("renders as a collapsed disclosure by default", () => {
    render(<SubmissionStatusGuide />);

    const trigger = screen.getByRole("button", { name: /What do these statuses mean\?/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
