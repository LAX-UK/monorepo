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
        sentBy="Lena Fischer"
        editHref="/selling/consignments/s1/edit"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Your specialist asked for changes" }),
    ).toBeVisible();
    expect(screen.getByText("Add a photo of the back and the signature.")).toBeVisible();
    expect(screen.getByText("Specialist · 6 Oct 2026")).toBeVisible();
  });

  it("offers one Make changes link to a member who can edit", () => {
    render(
      <SubmissionChangesRequestedPanel
        submission={{
          status: "changes_requested",
          changesRequestedNote: null,
          changesRequestedAt: null,
        }}
        sentBy="Lena Fischer"
        editHref="/selling/consignments/s1/edit"
      />,
    );
    expect(screen.getByRole("link", { name: "Make changes" })).toHaveAttribute(
      "href",
      "/selling/consignments/s1/edit",
    );
  });

  it("tells a read-only member who is making the changes, with no action", () => {
    render(
      <SubmissionChangesRequestedPanel
        submission={{
          status: "changes_requested",
          changesRequestedNote: null,
          changesRequestedAt: null,
        }}
        sentBy="Lena Fischer"
        editHref={null}
      />,
    );
    expect(
      screen.getByText("Lena Fischer is making the changes the specialist asked for."),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Make changes" })).toBeNull();
  });

  it("is not shown once the submission is back with the specialist", () => {
    const { container } = render(
      <SubmissionChangesRequestedPanel
        submission={{
          status: "submitted",
          changesRequestedNote: "Add a photo",
          changesRequestedAt: null,
        }}
        sentBy={null}
        editHref={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
