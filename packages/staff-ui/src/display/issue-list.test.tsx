import { PlainLink } from "@auction/ui/lax";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueList } from "./issue-list.js";

describe("IssueList", () => {
  it("lists the record's problems, most serious first, each linking to its fix", () => {
    render(
      <IssueList
        Link={PlainLink}
        items={[
          { id: "note", label: "No condition report", tone: "neutral" },
          {
            id: "photos",
            label: "Two lots have no photos",
            tone: "danger",
            tag: "Setup",
            action: { label: "Add photos", href: "/lots?needsPhotos=1" },
          },
          { id: "regs", label: "Three registrations wait for approval", tone: "warning" },
        ]}
      />,
    );
    const card = screen.getByRole("region", { name: "Needs attention" });
    const rows = within(card).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Two lots have no photosSetupAdd photos",
      "Three registrations wait for approval",
      "No condition report",
    ]);
    expect(within(card).getByRole("link", { name: "Add photos" })).toHaveAttribute(
      "href",
      "/lots?needsPhotos=1",
    );
  });

  it("says when nothing is open, or renders nothing when asked", () => {
    const { rerender, container } = render(<IssueList Link={PlainLink} items={[]} />);
    expect(screen.getByText("Nothing needs attention.")).toBeInTheDocument();
    rerender(<IssueList Link={PlainLink} items={[]} allClear={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers dismissing only when there is something to dismiss", () => {
    const dismiss = vi.fn();
    const { rerender } = render(
      <IssueList Link={PlainLink} items={[{ id: "a", label: "A" }]} onDismissAll={dismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss all" }));
    expect(dismiss).toHaveBeenCalled();
    rerender(<IssueList Link={PlainLink} items={[]} onDismissAll={dismiss} />);
    expect(screen.queryByRole("button", { name: "Dismiss all" })).not.toBeInTheDocument();
  });
});
