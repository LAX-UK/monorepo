import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { Checklist, type ChecklistItem } from "./checklist.js";

const Link = ({ href, children, ...rest }: React.ComponentProps<"a">) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

const items: ChecklistItem[] = [
  { id: "title", label: "Add a title", done: true, severity: "required" },
  {
    id: "photos",
    label: "Add at least one photo",
    done: false,
    severity: "required",
    href: "/photos",
  },
  { id: "copy", label: "Write a description", done: false, severity: "recommended", href: "/copy" },
];

describe("Checklist", () => {
  it("shows how much is done and what each open item needs", () => {
    render(<Checklist title="Ready to publish" items={items} Link={Link} />);
    expect(screen.getByRole("region", { name: "Ready to publish" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "Ready to publish" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getByText("Add a title")).toHaveTextContent("Add a title. Done");
    expect(screen.getByText("Add at least one photo")).toHaveTextContent(". Required");
    const fixes = screen.getAllByRole("link", { name: "Fix" });
    expect(fixes.map((link) => link.getAttribute("href"))).toEqual(["/photos", "/copy"]);
  });

  it("offers a way to hide it only when it can be hidden", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Checklist title="Ready to publish" items={items} Link={Link} />);
    expect(screen.queryByRole("button", { name: "Hide ready to publish" })).toBeNull();
    rerender(
      <Checklist title="Ready to publish" items={items} Link={Link} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide ready to publish" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("in compact form shows the progress and the first required item still open", () => {
    render(<Checklist title="Lot readiness" items={items} Link={Link} compact />);
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add at least one photo" })).toHaveAttribute(
      "href",
      "/photos",
    );
    expect(screen.queryByText("Write a description")).toBeNull();
  });
});
