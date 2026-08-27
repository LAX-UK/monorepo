import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidBlockerNotice } from "./bid-blocker-notice";

describe("BidBlockerNotice", () => {
  it("renders a link action and preview copy", () => {
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

  it("renders an email action as a verification button", () => {
    render(
      <BidBlockerNotice
        presentation={{
          tone: "warning",
          title: "Verify your email to bid",
          detail: "We’ll send a secure verification link.",
          action: {
            kind: "email",
            email: "buyer@example.com",
            next: "/lot/example/1",
            label: "Send verification email",
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Send verification email" })).toBeEnabled();
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

  it("renders panel content without an action control", () => {
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
    expect(screen.queryByRole("button", { name: "Complete registration" })).not.toBeInTheDocument();
  });
});
