import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeAlertsBand } from "./home-alerts-band";

afterEach(cleanup);

describe("HomeAlertsBand", () => {
  it("is the #alerts anchor and posts the form to the sign-up route", () => {
    const { container } = render(
      <HomeAlertsBand state="upcoming" signedIn={false} outcome={null} />,
    );
    expect(container.querySelector("section#alerts")).not.toBeNull();
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/api/sale-alerts/notify");
    expect(form?.querySelector('input[name="source"]')?.getAttribute("value")).toBe(
      "web_home_alerts",
    );
    expect(screen.getByRole("button", { name: "Get alerts" })).toBeTruthy();
    expect(screen.getByText(/unsubscribe at any time/)).toBeTruthy();
  });

  it("marks the field and says what is wrong for an invalid address", () => {
    render(<HomeAlertsBand state="upcoming" signedIn={false} outcome="invalid" />);
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address");
    const input = screen.getByLabelText("Your email address");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("home-alerts-problem");
  });

  it("replaces the form with Check your email once submitted", () => {
    const { container } = render(
      <HomeAlertsBand state="upcoming" signedIn={false} outcome="submitted" />,
    );
    expect(screen.getByRole("status").textContent).toContain("Check your email");
    expect(container.querySelector("form")).toBeNull();
  });

  it("sends a signed-in client to their own alert settings instead of the form", () => {
    const { container } = render(<HomeAlertsBand state="live" signedIn outcome={null} />);
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByRole("link", { name: "Alert settings" }).getAttribute("href")).toBe(
      "/settings#alerts",
    );
  });
});
