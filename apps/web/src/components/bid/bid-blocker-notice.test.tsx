import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidBlockerNotice } from "./bid-blocker-notice";

describe("BidBlockerNotice", () => {
  it("announces the blocker and renders recoverable preview copy", () => {
    render(
      <BidBlockerNotice
        presentation={{
          tone: "warning",
          title: "Verification required",
          detail: "Complete verification before bidding.",
          action: { kind: "link", href: "/verify", label: "Start verification" },
          preview: "After approval, bid controls become available.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveAccessibleName("Verification required");
    expect(screen.getByRole("link", { name: "Start verification" })).toHaveAttribute(
      "href",
      "/verify",
    );
    expect(screen.getByText(/bid controls become available/i)).toBeInTheDocument();
  });

  it("renders status-only actions without an interactive control", () => {
    render(
      <BidBlockerNotice
        presentation={{
          tone: "info",
          title: "Verification in review",
          detail: "We are reviewing your submission.",
          action: { kind: "status", label: "In review" },
        }}
      />,
    );

    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders typed custom recovery content inside the shared shell", () => {
    render(
      <BidBlockerNotice
        presentation={{
          tone: "warning",
          title: "Register to bid",
          detail: "Complete sale registration.",
          action: { kind: "panel", label: "Complete registration" },
          content: <form aria-label="Sale registration form" />,
        }}
      />,
    );

    expect(screen.getByRole("form", { name: "Sale registration form" })).toBeInTheDocument();
  });
});
