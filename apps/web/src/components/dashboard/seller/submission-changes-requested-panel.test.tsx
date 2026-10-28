import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionChangesRequestedPanel } from "./submission-changes-requested-panel";

describe("SubmissionChangesRequestedPanel", () => {
  it("shows the specialist's note word for word, with the date", () => {
    render(
      <SubmissionChangesRequestedPanel
        submission={{
          status: "changes_requested",
          changesRequestedNote: "Add a photo of the back and the signature.",
          changesRequestedAt: new Date("2026-10-06T09:00:00Z"),
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Your specialist asked for changes" }),
    ).toBeVisible();
    expect(screen.getByText("Add a photo of the back and the signature.")).toBeVisible();
    expect(screen.getByText("Specialist · 6 Oct 2026")).toBeVisible();
  });

  it("is not shown once the submission is back with the specialist", () => {
    const { container } = render(
      <SubmissionChangesRequestedPanel
        submission={{
          status: "submitted",
          changesRequestedNote: "Add a photo",
          changesRequestedAt: null,
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
