import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./home-alerts-signed-in", () => ({
  HomeAlertsSignedIn: () => <div data-testid="signed-in-alerts" />,
}));

import { HomeAlertsBand } from "./home-alerts-band";

afterEach(cleanup);

describe("HomeAlertsBand", () => {
  it("is the #alerts anchor and posts the form to the sign-up route", () => {
    const { container } = render(<HomeAlertsBand signedIn={false} outcome={null} />);
    expect(container.querySelector("#alerts")).not.toBeNull();
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/api/alerts/notify");
    expect(form?.querySelector('input[name="source"]')?.getAttribute("value")).toBe(
      "web_home_alerts",
    );
    expect(screen.getByRole("button", { name: "Get sale alerts" })).toBeTruthy();
    expect(screen.getByText(/stop at any time/)).toBeTruthy();
  });

  it("promises one announcement per sale and at most one email a day", () => {
    render(<HomeAlertsBand signedIn={false} outcome={null} />);
    expect(screen.getByRole("heading", { name: "Hear about new sales first" })).toBeTruthy();
    expect(
      screen.getByText(
        "One email when a sale is announced, with its dates and catalogue. At most one email a day.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("then the catalogue when it goes online");
  });

  it("marks the field and says what is wrong for an invalid address", () => {
    render(<HomeAlertsBand signedIn={false} outcome="invalid" />);
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address");
    const input = screen.getByLabelText("Your email address");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("home-alerts-problem");
  });

  it("replaces the form with Check your email once submitted", () => {
    const { container } = render(<HomeAlertsBand signedIn={false} outcome="submitted" />);
    expect(screen.getByRole("status").textContent).toContain("Check your email");
    expect(container.querySelector("form")).toBeNull();
  });

  it("hands a signed-in client to the signed-in states instead of the form", () => {
    const { container } = render(<HomeAlertsBand signedIn outcome={null} />);
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByTestId("signed-in-alerts")).toBeTruthy();
  });
});
