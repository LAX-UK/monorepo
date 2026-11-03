import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeAlertsVisitorForm } from "./home-alerts-visitor-form";

afterEach(cleanup);

const props = { action: "/api/alerts/notify", outcome: null, message: null, consent: "Consent." };

describe("HomeAlertsVisitorForm", () => {
  it("shows one message under the field, with no summary, and focuses the field", () => {
    render(<HomeAlertsVisitorForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Get sale alerts" }));
    expect(screen.queryByText("There is a problem")).toBeNull();
    const input = screen.getByLabelText("Your email address");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("home-alerts-email-error");
    expect(screen.getByText("Enter your email address")).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("does not use the browser's own validation bubble", () => {
    const { container } = render(<HomeAlertsVisitorForm {...props} />);
    expect(container.querySelector("form")?.noValidate).toBe(true);
  });

  it("keeps the server's message for a sign-up posted without script", () => {
    render(
      <HomeAlertsVisitorForm
        {...props}
        outcome="invalid"
        message={{ tone: "danger", title: "Enter a valid email address", body: "Check it." }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address");
    expect(screen.getByLabelText("Your email address").getAttribute("aria-describedby")).toBe(
      "home-alerts-problem",
    );
  });
});
